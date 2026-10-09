import {
  adapterFor,
  EMPTY_PROFILE,
  canonicalJobUrl,
  discoverNote,
  fetchBuiltInJobQueue,
  hydrateProfile,
  loginHost,
  markLiveJob,
  mergeLiveJobs,
  isSupportedApplyUrl,
  looksLikeApplicationPage,
  handoffPlan,
  KEEP_HANDOFF_SETTLE_MS,
  mayHandoffToNextJob,
  planPage,
  shouldBlockPage,
  type ApplyQueueItem,
  type SubmitEvidence,
  type EmployerRecord,
  type Profile,
  type ScanSnapshot,
} from "@fillglen/core";
import type { FromPanel, KeepStatus, ToBackground, ToContent, ToPanel } from "./shared/messages";
import { loadDiscover, runDiscoverTick } from "./backgroundDiscover";
import { getLocalRecord } from "@fillglen/core";
import { ingestFromStorage, recordHarvestTick, runDbQuery, runDbStats } from "./ingestDb";
import {
  forgetOpenTab,
  hydrateRuntime,
  saveAction,
  saveHandoff,
  saveKeep,
  savePageKeep,
  saveSnapshot,
  saveTabSnapshot,
  saveWarmup,
  snapshotForOpenTab,
} from "./persistSession";

const contentPorts = new Map<number, Set<chrome.runtime.Port>>();
const panelPorts = new Set<chrome.runtime.Port>();
const snapshots = new Map<number, ScanSnapshot>();
let warmupTabId: number | null = null;
let warmupUrl: string | null = null;
let handoffLock = false;
const handedOffTabs = new Set<number>();

async function snapFor(tabId: number, url?: string): Promise<ScanSnapshot | undefined> {
  const live = snapshots.get(tabId);
  if (live) return live;
  const saved = await snapshotForOpenTab(tabId, url);
  if (saved) snapshots.set(tabId, saved);
  return saved;
}

async function persistSnap(tabId: number, snap: ScanSnapshot) {
  snapshots.set(tabId, snap);
  await saveTabSnapshot(tabId, snap).catch(() => {});
}

async function journal(type: string, detail: string, snap?: ScanSnapshot | null, url?: string) {
  await saveAction({
    at: new Date().toISOString(),
    type,
    url: snap?.job.url || url || "",
    title: snap?.job.title || "",
    company: snap?.job.company || "",
    detail,
  }).catch(() => {});
}

async function restoreRuntime() {
  const hydrated = await hydrateRuntime();
  for (const row of hydrated.snapshots) snapshots.set(row.tabId, row.snap);
  if (hydrated.warmupTabId != null) warmupTabId = hydrated.warmupTabId;
  if (hydrated.warmupUrl) warmupUrl = hydrated.warmupUrl;
  for (const id of hydrated.handedOffTabIds) handedOffTabs.add(id);
  const { keepApplying } = await chrome.storage.local.get(["keepApplying"]);
  if (keepApplying) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#d9763a" });
    chrome.alarms.create("fillglen-keep", { periodInMinutes: 1 });
    startLiveAlarm();
    await ensureKeepOffscreen();
    pingKeepTabs();
  }
}

restoreRuntime().catch(() => {});

async function loadProfile(): Promise<Profile> {
  const stored = await chrome.storage.local.get(["profile"]);
  return hydrateProfile((stored.profile as Profile) || EMPTY_PROFILE);
}

async function isPaused(origin: string): Promise<boolean> {
  const { pausedOrigins = [] } = await chrome.storage.local.get(["pausedOrigins"]);
  return (pausedOrigins as string[]).includes(origin);
}

function broadcastPanel(msg: ToPanel) {
  for (const p of panelPorts) {
    try {
      p.postMessage(msg);
    } catch {
      panelPorts.delete(p);
    }
  }
}

async function pushState(tabId: number | null) {
  const profile = await loadProfile();
  let snapshot = tabId != null ? snapshots.get(tabId) || null : null;
  if (tabId != null && !snapshot) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    snapshot = (await snapFor(tabId, tab?.url)) || null;
  }
  let paused = false;
  if (snapshot?.job.url) {
    try {
      paused = await isPaused(new URL(snapshot.job.url).origin);
    } catch {
      paused = false;
    }
  }
  const { keepApplying } = await chrome.storage.local.get(["keepApplying"]);
  broadcastPanel({ type: "state", snapshot, profile, paused, tabId, keepApplying: Boolean(keepApplying) });
}

function sendToTab(tabId: number, msg: ToContent) {
  const ports = contentPorts.get(tabId);
  if (!ports) return;
  for (const p of ports) {
    try {
      p.postMessage(msg);
    } catch {
      ports.delete(p);
    }
  }
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "fillglen-content") {
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;
    if (!contentPorts.has(tabId)) contentPorts.set(tabId, new Set());
    contentPorts.get(tabId)!.add(port);
    port.onMessage.addListener(async (msg: ToBackground) => {
      if (msg.type === "scan" || msg.type === "delta") {
        const prev = snapshots.get(tabId) || (await snapFor(tabId, port.sender?.tab?.url));
        const snap =
          msg.type === "scan"
            ? msg.snapshot
            : { ...(prev as ScanSnapshot), questions: msg.questions };
        if (snap?.job) await persistSnap(tabId, snap);
        if (msg.type === "scan" && snap && !snap.blockedReason) {
          await maybeTrack(snap);
          await journal("scan", `${snap.questions?.length || 0} fields`, snap);
        }
        await pushState(tabId);
      }
      if (msg.type === "keep-status") {
        await onKeepStatus(tabId, msg.status, msg.url, msg.detail, msg.submitEvidence);
      }
      if (msg.type === "store-board-password") {
        await storePasswordInChrome(tabId, msg.email, msg.password, msg.url || port.sender?.tab?.url || "");
      }
      if (msg.type === "typed") {
        const prev = snapshots.get(tabId) || (await snapFor(tabId, port.sender?.tab?.url));
        if (prev) {
          const snap = {
            ...prev,
            questions: prev.questions.map((q) =>
              q.id === msg.questionId ? { ...q, value: msg.value, source: "user" as const, status: msg.value ? "filled" as const : "needs-you" as const } : q
            ),
          };
          await persistSnap(tabId, snap);
          await pushState(tabId);
        }
      }
      if (msg.type === "page-keep") {
        await savePageKeep(msg.keep).catch(() => {});
      }
      if (msg.type === "persist-now") {
        const prev = snapshots.get(tabId) || (await snapFor(tabId, port.sender?.tab?.url));
        const snap = msg.snapshot || (prev && msg.questions ? { ...prev, questions: msg.questions } : prev);
        if (snap) await persistSnap(tabId, snap);
      }
      if (msg.type === "open-panel" || msg.type === "open-panel-database") {
        if (msg.type === "open-panel-database") {
          await chrome.storage.local.set({ panelTab: "database" });
        }
        chrome.sidePanel.open({ tabId }).catch(() => {});
      }
    });
    port.onDisconnect.addListener(() => {
      contentPorts.get(tabId)?.delete(port);
    });
  }

  if (port.name === "fillglen-panel") {
    panelPorts.add(port);
    port.onMessage.addListener(async (msg: FromPanel) => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabId = msg.type === "subscribe" && msg.tabId ? msg.tabId : tab?.id ?? null;
      if (msg.type === "subscribe") {
        await pushState(tabId);
        return;
      }
      if (tabId == null) return;
      if (msg.type === "fill-page") {
        const profile = await loadProfile();
        const snap = await snapFor(tabId, tab?.url);
        if (!snap) return;
        await journal("fill-page", `${snap.questions.length} fields`, snap);
        sendToTab(tabId, { type: "fill-plans", plans: planPage(snap.questions, profile) });
      }
      if (msg.type === "fill-one" || msg.type === "edit-value") {
        const prev = await snapFor(tabId, tab?.url);
        if (prev) {
          const snap = {
            ...prev,
            questions: prev.questions.map((q) =>
              q.id === msg.questionId ? { ...q, value: msg.value, source: "user" as const, status: msg.value ? "filled" as const : "needs-you" as const } : q
            ),
          };
          await persistSnap(tabId, snap);
        }
        sendToTab(tabId, { type: "fill-one", questionId: msg.questionId, value: msg.value });
      }
      if (msg.type === "insert-draft") {
        const prev = await snapFor(tabId, tab?.url);
        if (prev) {
          const snap = {
            ...prev,
            questions: prev.questions.map((q) =>
              q.id === msg.questionId ? { ...q, value: msg.text, source: "ai-draft" as const, status: "filled" as const } : q
            ),
          };
          await persistSnap(tabId, snap);
          await journal("insert-draft", msg.questionId, snap);
        }
        sendToTab(tabId, { type: "fill-one", questionId: msg.questionId, value: msg.text });
      }
      if (msg.type === "focus") sendToTab(tabId, { type: "focus", questionId: msg.questionId });
      if (msg.type === "undo") {
        await journal("undo", msg.questionId || "page", await snapFor(tabId, tab?.url));
        sendToTab(tabId, { type: "undo", questionId: msg.questionId });
      }
      if (msg.type === "pause") {
        const origin = msg.origin || (tab?.url ? new URL(tab.url).origin : "");
        const { pausedOrigins = [] } = await chrome.storage.local.get(["pausedOrigins"]);
        const next = new Set(pausedOrigins as string[]);
        if (next.has(origin)) next.delete(origin);
        else next.add(origin);
        await chrome.storage.local.set({ pausedOrigins: [...next] });
        const snap = await snapFor(tabId, tab?.url);
        await journal("pause", origin, snap, origin);
        await pushState(tabId);
      }
      if (msg.type === "start-keep-applying") await setKeepApplying(true, tabId);
      if (msg.type === "stop-keep-applying") await setKeepApplying(false, tabId);
      if (msg.type === "save-answer") {
        const profile = await loadProfile();
        profile.answers = [
          { id: crypto.randomUUID(), pattern: msg.pattern, answer: msg.answer, tags: [], useCount: 1, lastUsedAt: new Date().toISOString() },
          ...profile.answers.filter((a) => a.pattern !== msg.pattern),
        ];
        await chrome.storage.local.set({ profile });
        const snap = await snapFor(tabId, tab?.url);
        await journal("save-answer", msg.pattern, snap);
        await pushState(tabId);
      }
      if (msg.type === "draft-ai") {
        await requestDraft(tabId, msg.questionId);
      }
      if (msg.type === "popout") {
        await chrome.windows.create({
          url: chrome.runtime.getURL("src/panel/index.html?popout=1"),
          type: "popup",
          width: 420,
          height: 780,
        });
      }
    });
    port.onDisconnect.addListener(() => panelPorts.delete(port));
  }
});

async function requestDraft(tabId: number, questionId: string) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const snap = await snapFor(tabId, tab?.url);
  const q = snap?.questions.find((x) => x.id === questionId);
  const profile = await loadProfile();
  if (!q) return;
  const { apiBase, sessionToken } = await chrome.storage.local.get(["apiBase", "sessionToken"]);
  if (!apiBase || !sessionToken) {
    broadcastPanel({
      type: "draft",
      questionId,
      text: "",
      usedFacts: [],
      refused: true,
      reason: "Sign in on the Fillglen dashboard so the server can draft. The extension never holds an API key.",
    });
    return;
  }
  try {
    const res = await fetch(`${apiBase}/v1/ai/draft`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        question: q.label,
        type: q.type,
        wordLimit: q.wordLimit,
        charLimit: q.charLimit,
        jobTitle: snap?.job.title,
        company: snap?.job.company,
        jobDescription: snap?.job.description,
      }),
    });
    const body = await res.json();
    broadcastPanel({
      type: "draft",
      questionId,
      text: body.text || "",
      usedFacts: body.usedFacts || [],
      refused: Boolean(body.refused),
      reason: body.reason,
    });
  } catch (err) {
    broadcastPanel({
      type: "draft",
      questionId,
      text: "",
      usedFacts: [],
      refused: true,
      reason: err instanceof Error ? err.message : "Draft request failed",
    });
  }
}

async function maybeTrack(snap: ScanSnapshot) {
  const { applications = [], jobs = [] } = await chrome.storage.local.get(["applications", "jobs"]);
  if ((jobs as { url: string }[]).some((j) => j.url === snap.job.url)) return;
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  jobs.push({
    id: jobId,
    company: snap.job.company,
    title: snap.job.title,
    url: snap.job.url,
    board: snap.job.board,
    description: snap.job.description,
    createdAt: now,
  });
  applications.push({
    id: crypto.randomUUID(),
    jobId,
    status: "saved",
    answersSent: [],
    notes: "",
    recruiter: "",
    interviewDates: [],
    followUpOn: null,
    createdAt: now,
    appliedAt: null,
  });
  await chrome.storage.local.set({ jobs, applications });
  ingestFromStorage().catch(() => {});
  await journal("listing", `${snap.job.title} · ${snap.job.company}`, snap);
}

function looksApply(url?: string) {
  return Boolean(url && (isSupportedApplyUrl(url) || looksLikeApplicationPage(url)) && !shouldBlockPage(url));
}

function looksKeepTab(url?: string) {
  return looksApply(url) || /accounts\.google\.com/i.test(url || "");
}

function pingKeepTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (!t.id || t.id === warmupTabId) continue;
      if (looksKeepTab(t.url)) sendToTab(t.id, { type: "keep-tick" });
    }
  });
}

async function ensureKeepOffscreen() {
  if (!chrome.offscreen) return;
  try {
    const has = await chrome.offscreen.hasDocument?.();
    if (has) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Keep applying and searching while Chrome stays open.",
    });
  } catch {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: "Keep applying and searching while Chrome stays open.",
      });
    } catch {
      /* alarms still tick once a minute */
    }
  }
}

async function closeKeepOffscreen() {
  try {
    await chrome.offscreen?.closeDocument();
  } catch {
    /* already closed */
  }
}

async function storePasswordInChrome(tabId: number, email: string, password: string, url: string) {
  if (!email || !password) return;
  const host = loginHost(url);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: string, pwd: string, name: string) => {
        const Ctor = (
          window as unknown as {
            PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
          }
        ).PasswordCredential;
        if (!Ctor || !navigator.credentials?.store) return false;
        return navigator.credentials
          .store(new Ctor({ id, password: pwd, name }))
          .then(() => true)
          .catch(() => false);
      },
      args: [email, password, host || "job board"],
    });
  } catch {
    /* page CSP or missing Credential Management API */
  }
}

async function ping(tabId: number, url: string) {
  if (!looksApply(url)) return;
  if (adapterFor(url) || isSupportedApplyUrl(url)) {
    chrome.sidePanel.setOptions({ tabId, path: "src/panel/index.html", enabled: true }).catch(() => {});
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  const url = info.url || tab.url;
  if (url) ping(tabId, url);
  if (info.discarded && snapshots.has(tabId)) {
    saveTabSnapshot(tabId, snapshots.get(tabId)!).catch(() => {});
  }
  if (info.status === "complete") {
    chrome.storage.local.get(["keepApplying"], (r) => {
      if (!r.keepApplying) return;
      if (tabId === warmupTabId) return;
      if (tab.id && looksKeepTab(tab.url || url)) sendToTab(tab.id, { type: "keep-tick" });
    });
    snapFor(tabId, url).then(() => pushState(tabId)).catch(() => {});
  }
});

chrome.webNavigation?.onCommitted.addListener((d) => {
  if (d.frameId !== 0) return;
  ping(d.tabId, d.url);
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying || d.tabId === warmupTabId) return;
    if (looksKeepTab(d.url)) sendToTab(d.tabId, { type: "keep-tick" });
  });
});
chrome.webNavigation?.onCompleted.addListener((d) => {
  if (d.frameId === 0) ping(d.tabId, d.url);
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying || d.frameId !== 0 || d.tabId === warmupTabId) return;
    if (looksKeepTab(d.url)) sendToTab(d.tabId, { type: "keep-tick" });
  });
});
chrome.webNavigation?.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId === 0) ping(d.tabId, d.url);
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying || d.frameId !== 0 || d.tabId === warmupTabId) return;
    if (looksKeepTab(d.url)) sendToTab(d.tabId, { type: "keep-tick" });
  });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  handedOffTabs.delete(tabId);
  const snap = snapshots.get(tabId);
  if (snap) saveTabSnapshot(tabId, snap).catch(() => {});
  snapshots.delete(tabId);
  forgetOpenTab(tabId).catch(() => {});
  if (tabId === warmupTabId) {
    warmupTabId = null;
    warmupUrl = null;
    saveWarmup(null, null).catch(() => {});
  }
});
chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      pushState(info.tabId).catch(() => {});
      return;
    }
    const url = tab?.url;
    snapFor(info.tabId, url)
      .then(async (snap) => {
        await journal("tab-activate", url || "", snap, url);
        await pushState(info.tabId);
      })
      .catch(() => pushState(info.tabId));
  });
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying || info.tabId === warmupTabId) return;
    sendToTab(info.tabId, { type: "keep-tick" });
  });
});

function startLiveAlarm() {
  chrome.alarms.create("fillglen-live", { periodInMinutes: 1 });
}

function startDbAlarm() {
  chrome.alarms.create("fillglen-db", { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["profile"], (r) => {
    if (!r.profile) chrome.storage.local.set({ profile: EMPTY_PROFILE });
  });
  startLiveAlarm();
  startDbAlarm();
  restoreRuntime().catch(() => {});
  harvestLiveJobs().catch(() => {});
});
chrome.runtime.onStartup?.addListener(() => {
  startLiveAlarm();
  startDbAlarm();
  restoreRuntime().catch(() => {});
  harvestLiveJobs().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
  if (msg?.type === "keep-heartbeat") {
    pingKeepTabs();
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "store-board-password") {
    const tabId = _sender.tab?.id;
    const payload = msg as { email?: string; password?: string; url?: string };
    if (tabId != null && payload.email && payload.password) {
      storePasswordInChrome(tabId, payload.email, payload.password, payload.url || _sender.tab?.url || "")
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  }
  if (msg?.type === "start-keep-applying") {
    setKeepApplying(true).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "stop-keep-applying") {
    setKeepApplying(false).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "refresh-queue") {
    harvestLiveJobs()
      .then(async (queue) => {
        const { discoverStatus, liveJobs } = await chrome.storage.local.get(["discoverStatus", "liveJobs"]);
        sendResponse({
          ok: true,
          count: queue.length,
          top: queue.slice(0, 8),
          lookup: queue,
          liveJobs: liveJobs || queue,
          discover: discoverStatus,
        });
      })
      .catch(() => sendResponse({ ok: false, count: 0, top: [], lookup: [], liveJobs: [] }));
    return true;
  }
  if (msg?.type === "open-live-job" && typeof (msg as { url?: string }).url === "string") {
    const url = (msg as { url: string }).url;
    openLiveJob(url).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "db-query") {
    runDbQuery(((msg as { query?: Record<string, unknown> }).query || msg) as Record<string, unknown>)
      .then((body) => sendResponse({ ok: true, ...body }))
      .catch(() => sendResponse({ ok: false, rows: [], total: 0, stats: { total: 0 } }));
    return true;
  }
  if (msg?.type === "db-refresh") {
    const query = ((msg as { query?: Record<string, unknown> }).query || {}) as Record<string, unknown>;
    harvestLiveJobs()
      .then(() => runDbQuery(query))
      .then((body) => sendResponse({ ok: true, ...body }))
      .catch(() =>
        runDbQuery(query)
          .then((body) => sendResponse({ ok: true, ...body }))
          .catch(() => sendResponse({ ok: false, rows: [], total: 0, stats: { total: 0 } }))
      );
    return true;
  }
  if (msg?.type === "db-stats") {
    runDbStats()
      .then((stats) => sendResponse({ ok: true, stats }))
      .catch(() => sendResponse({ ok: false, stats: { total: 0 } }));
    return true;
  }
  if (msg?.type === "db-get" && typeof (msg as { id?: string }).id === "string") {
    getLocalRecord((msg as { id: string }).id)
      .then((row) => sendResponse({ ok: Boolean(row), row }))
      .catch(() => sendResponse({ ok: false, row: null }));
    return true;
  }
  if (msg?.type === "db-ingest") {
    ingestFromStorage()
      .then((stats) => sendResponse({ ok: true, stats }))
      .catch(() => sendResponse({ ok: false, stats: { total: 0 } }));
    return true;
  }
  if (msg?.type === "persist-now") {
    const tabId = _sender.tab?.id;
    const payload = msg as { snapshot?: ScanSnapshot; questions?: ScanSnapshot["questions"] };
    const prev = tabId != null ? snapshots.get(tabId) : undefined;
    const snap = payload.snapshot || (prev && payload.questions ? { ...prev, questions: payload.questions } : prev);
    if (snap && tabId != null) {
      persistSnap(tabId, snap).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (snap) {
      saveSnapshot(snap, tabId).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    sendResponse({ ok: false });
    return true;
  }
  if (msg?.type === "page-keep" && (msg as { keep?: { url: string } }).keep) {
    savePageKeep((msg as { keep: { url: string; stuckTicks: number; googleClicked: boolean; waitingOnCaptcha: boolean; undoStack: { id: string; prev: string }[] } }).keep)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg?.type === "keep-status") {
    const tabId = _sender.tab?.id;
    const payload = msg as { status?: KeepStatus; url?: string; detail?: string; submitEvidence?: SubmitEvidence };
    if (tabId != null && payload.status) {
      onKeepStatus(tabId, payload.status, payload.url, payload.detail, payload.submitEvidence)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  }
  if (msg?.type === "session-restore") {
    const tabId = _sender.tab?.id ?? (msg as { tabId?: number }).tabId;
    const url = _sender.tab?.url || (msg as { url?: string }).url;
    if (tabId != null) {
      snapFor(tabId, url)
        .then((snap) => sendResponse({ ok: Boolean(snap), snapshot: snap || null }))
        .catch(() => sendResponse({ ok: false, snapshot: null }));
      return true;
    }
  }
  return undefined;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fillglen-live") {
    harvestLiveJobs().catch(() => {});
    return;
  }
  if (alarm.name === "fillglen-db") {
    ingestFromStorage().catch(() => {});
    return;
  }
  if (alarm.name !== "fillglen-keep") return;
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying) return;
    pingKeepTabs();
    ensureKeepOffscreen().catch(() => {});
    runDiscoverTick()
      .then(() => harvestLiveJobs())
      .catch(() => {});
  });
});

async function rebuildQueue(): Promise<ApplyQueueItem[]> {
  const { finderMatches, discoveredEmployers, profile } = await chrome.storage.local.get([
    "finderMatches",
    "discoveredEmployers",
    "profile",
  ]);
  const lookup = (finderMatches?.lookup || finderMatches?.top || []) as ApplyQueueItem[];
  let builtIn: ApplyQueueItem[] = [];
  try {
        builtIn = await fetchBuiltInJobQueue(100, {
      profile: hydrateProfile((profile as Profile) || EMPTY_PROFILE),
      extraEmployers: (discoveredEmployers as EmployerRecord[]) || [],
      onDeepLayer: async ({ employers: rows, gov, records }) => {
        const stored = await chrome.storage.local.get(["discoveredEmployers", "discoverStatus"]);
        const existing = (stored.discoveredEmployers as EmployerRecord[]) || [];
        const known = new Set(existing.map((e) => e.company.toLowerCase()));
        const merged = [...existing];
        for (const rec of rows) {
          if (!rec?.company || known.has(rec.company.toLowerCase())) continue;
          known.add(rec.company.toLowerCase());
          merged.push(rec);
        }
        const status = stored.discoverStatus || {};
        const next = {
          ...status,
          govJobs: gov,
          recordsCompanies: (status.recordsCompanies || 0) + records,
          lastAt: new Date().toISOString(),
        };
        await chrome.storage.local.set({
          discoveredEmployers: merged.slice(-400),
          discoverStatus: { ...next, note: discoverNote(next) },
        });
      },
    });
  } catch {
    builtIn = [];
  }
  const seen = new Set<string>();
  const queue: ApplyQueueItem[] = [];
  for (const j of [...builtIn, ...lookup]) {
    if (!j?.url || /linkedin\.com|indeed\.com|glassdoor\.com/i.test(j.url)) continue;
    const key = canonicalJobUrl(j.url);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({
      url: j.url,
      title: j.title || "Job",
      company: j.company || "",
      source: j.source,
      location: j.location,
      score: j.score,
      why: j.why,
    });
  }
  const compact = {
    count: queue.length,
    top: queue.slice(0, 8),
    lookup: queue,
  };
  await chrome.storage.local.set({ applyQueue: queue, finderMatches: compact });
  return queue;
}

async function harvestLiveJobs(): Promise<ApplyQueueItem[]> {
  const queue = await rebuildQueue();
  const { liveJobs = [] } = await chrome.storage.local.get(["liveJobs"]);
  const merged = mergeLiveJobs((liveJobs as ApplyQueueItem[]) || [], queue, 200);
  await chrome.storage.local.set({ liveJobs: merged, liveJobsHarvestedAt: new Date().toISOString() });
  recordHarvestTick(queue.length, merged.length).catch(() => {});
  return queue;
}

async function openLiveJob(url: string) {
  const { liveJobs = [] } = await chrome.storage.local.get(["liveJobs"]);
  const marked = markLiveJob(liveJobs as ApplyQueueItem[], url, { openedAt: new Date().toISOString() });
  await chrome.storage.local.set({ liveJobs: marked });
  ingestFromStorage().catch(() => {});
  const hit = marked.find((j) => canonicalJobUrl(j.url) === canonicalJobUrl(url));
  await journal("open-job", hit?.title || url, undefined, url);
  await chrome.tabs.create({ url });
}

async function cachedQueue(): Promise<ApplyQueueItem[]> {
  const { applyQueue = [], liveJobs = [] } = await chrome.storage.local.get(["applyQueue", "liveJobs"]);
  const list = (applyQueue as ApplyQueueItem[]).length ? applyQueue : liveJobs;
  return (list as ApplyQueueItem[]).filter((j) => j?.url);
}

async function warmup(url: string) {
  if (!url || /linkedin\.com|indeed\.com|glassdoor\.com/i.test(url)) return;
  if (warmupUrl && canonicalJobUrl(warmupUrl) === canonicalJobUrl(url) && warmupTabId != null) {
    try {
      const tab = await chrome.tabs.get(warmupTabId);
      if (tab?.id && !tab.discarded) return;
    } catch {
      warmupTabId = null;
      warmupUrl = null;
    }
  }
  if (warmupTabId != null) {
    const old = warmupTabId;
    warmupTabId = null;
    warmupUrl = null;
    chrome.tabs.remove(old).catch(() => {});
  }
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (tab.id == null) return;
    warmupTabId = tab.id;
    warmupUrl = url;
    await saveWarmup(tab.id, url).catch(() => {});
  } catch {
    warmupTabId = null;
    warmupUrl = null;
    await saveWarmup(null, null).catch(() => {});
  }
}

async function prefetchNext(currentUrl?: string, queue?: ApplyQueueItem[]) {
  const list = queue || (await cachedQueue());
  const item = currentUrl
    ? handoffPlan({ queue: list, currentUrl, reason: "stuck" }).next
    : list.find((j) => j.url && !j.appliedAt) || null;
  if (item?.url) await warmup(item.url);
}

async function closeWarmup() {
  const id = warmupTabId;
  warmupTabId = null;
  warmupUrl = null;
  await saveWarmup(null, null).catch(() => {});
  if (id != null) chrome.tabs.remove(id).catch(() => {});
}

async function goToNextJob(fromTabId: number, currentUrl: string, reason: "submitted" | "stuck" | "blocked" | "done-job") {
  if (handoffLock || handedOffTabs.has(fromTabId)) return;
  handoffLock = true;
  handedOffTabs.add(fromTabId);
  try {
    const queue = await cachedQueue();
    const plan = handoffPlan({
      queue,
      currentUrl,
      warmupUrl,
      warmupTabId,
      reason,
    });
    if (!plan.next?.url) {
      chrome.action.setBadgeText({ text: "DONE" });
      await journal("handoff-done", reason, snapshots.get(fromTabId), currentUrl);
      return;
    }
    const nextUrl = plan.next.url;
    await saveHandoff(fromTabId, nextUrl).catch(() => {});
    await journal("handoff", `${reason} → ${plan.next.title || nextUrl}`, snapshots.get(fromTabId), currentUrl);
    if (plan.useWarmup && warmupTabId != null) {
      const warmed = warmupTabId;
      warmupTabId = null;
      warmupUrl = null;
      await saveWarmup(null, null).catch(() => {});
      await chrome.tabs.update(warmed, { active: true }).catch(() => chrome.tabs.update(fromTabId, { url: nextUrl }));
      setTimeout(() => sendToTab(warmed, { type: "keep-tick" }), KEEP_HANDOFF_SETTLE_MS);
      setTimeout(() => chrome.tabs.remove(fromTabId).catch(() => {}), plan.closeCurrentAfterMs);
      if (plan.prefetchUrl) warmup(plan.prefetchUrl).catch(() => {});
      return;
    }
    chrome.tabs.update(fromTabId, { url: nextUrl });
    await closeWarmup();
    if (plan.prefetchUrl) warmup(plan.prefetchUrl).catch(() => {});
  } finally {
    handoffLock = false;
  }
}

async function setKeepApplying(on: boolean, tabId?: number | null) {
  await chrome.storage.local.set({ keepApplying: on });
  await saveKeep(on ? "fill" : "idle", "", on ? "keep applying on" : "keep applying off", tabId ?? undefined).catch(() => {});
  await journal(on ? "keep-on" : "keep-off", on ? "started" : "stopped");
  if (on) {
    chrome.alarms.create("fillglen-keep", { periodInMinutes: 1 });
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#d9763a" });
    startLiveAlarm();
    await ensureKeepOffscreen();
    const ready = await cachedQueue();
    const [tab] = tabId
      ? [await chrome.tabs.get(tabId).catch(() => null)]
      : await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const id = tab?.id;
    pingKeepTabs();
    if (id) sendToTab(id, { type: "keep-tick" });
    const url = tab?.url || "";
    const first = ready.find((j) => !j.appliedAt);
    if (id && !looksApply(url) && first) chrome.tabs.update(id, { url: first.url });
    prefetchNext(looksApply(url) ? url : first?.url, ready).catch(() => {});
    harvestLiveJobs()
      .then((queue) => prefetchNext(looksApply(url) ? url : queue[0]?.url, queue))
      .catch(() => {});
    runDiscoverTick().then(() => harvestLiveJobs()).catch(() => {});
  } else {
    await chrome.alarms.clear("fillglen-keep");
    chrome.action.setBadgeText({ text: "" });
    await closeKeepOffscreen();
    await closeWarmup();
    const { status } = await loadDiscover();
    await chrome.storage.local.set({
      discoverStatus: { ...status, running: false, note: "Discovery paused. Turn keep applying back on to continue the Texas map scan." },
    });
  }
}

startLiveAlarm();
startDbAlarm();

async function onKeepStatus(
  tabId: number,
  status: KeepStatus,
  currentUrl?: string,
  _detail?: string,
  submitEvidence?: SubmitEvidence
) {
  const snap = snapshots.get(tabId) || (currentUrl ? await snapFor(tabId, currentUrl) : undefined);
  await saveKeep(status, currentUrl || snap?.job.url || "", _detail, tabId).catch(() => {});
  const { keepApplying, applyQueue = [] } = await chrome.storage.local.get(["keepApplying", "applyQueue"]);
  if (!keepApplying) return;
  if (status === "advanced") return;
  if (status === "captcha") {
    chrome.action.setBadgeText({ text: "WAIT" });
    chrome.notifications?.create("fillglen-captcha", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("public/icon128.png"),
      title: "Fillglen: CAPTCHA on screen",
      message: "Solve it yourself. Fillglen waits on this tab, then keeps applying. It never solves CAPTCHAs.",
    });
    return;
  }
  if (status === "fill") {
    chrome.action.setBadgeText({ text: "ON" });
    return;
  }
  if (status === "stuck") {
    chrome.action.setBadgeText({ text: "…" });
    return;
  }
  if (status === "blocked" || status === "submitted" || status === "done-job") {
    const reason = status === "blocked" ? "blocked" : status === "done-job" ? "done-job" : "submitted";
    const gate = mayHandoffToNextJob({ reason, evidence: submitEvidence });
    if (!gate.ok) {
      chrome.action.setBadgeText({ text: "ON" });
      return;
    }
    if (currentUrl && reason === "submitted") {
      const now = new Date().toISOString();
      const { liveJobs = [] } = await chrome.storage.local.get(["liveJobs"]);
      const marked = (applyQueue as ApplyQueueItem[]).map((j) =>
        canonicalJobUrl(j.url) === canonicalJobUrl(currentUrl) ? { ...j, appliedAt: now } : j
      );
      await chrome.storage.local.set({
        applyQueue: marked,
        liveJobs: markLiveJob(liveJobs as ApplyQueueItem[], currentUrl, { appliedAt: now }),
      });
      ingestFromStorage().catch(() => {});
    }
    goToNextJob(tabId, currentUrl || "", reason).catch(() => {});
  }
}
