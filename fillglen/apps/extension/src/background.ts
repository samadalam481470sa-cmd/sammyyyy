import {
  adapterFor,
  EMPTY_PROFILE,
  canonicalJobUrl,
  fetchBuiltInJobQueue,
  hydrateProfile,
  markLiveJob,
  mergeLiveJobs,
  isSupportedApplyUrl,
  looksLikeApplicationPage,
  nextQueueItem,
  planPage,
  shouldBlockPage,
  type ApplyQueueItem,
  type EmployerRecord,
  type Profile,
  type ScanSnapshot,
} from "@fillglen/core";
import type { FromPanel, KeepStatus, ToBackground, ToContent, ToPanel } from "./shared/messages";
import { loadDiscover, runDiscoverTick } from "./backgroundDiscover";

const contentPorts = new Map<number, Set<chrome.runtime.Port>>();
const panelPorts = new Set<chrome.runtime.Port>();
const snapshots = new Map<number, ScanSnapshot>();

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
  const snapshot = tabId != null ? snapshots.get(tabId) || null : null;
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
        const snap = msg.type === "scan" ? msg.snapshot : { ...(snapshots.get(tabId) as ScanSnapshot), questions: msg.questions };
        snapshots.set(tabId, snap);
        if (msg.type === "scan" && !snap.blockedReason) {
          await maybeTrack(snap);
        }
        await pushState(tabId);
      }
      if (msg.type === "keep-status") {
        await onKeepStatus(tabId, msg.status, msg.url, msg.detail);
      }
      if (msg.type === "typed" && snapshots.has(tabId)) {
        const snap = snapshots.get(tabId)!;
        snap.questions = snap.questions.map((q) =>
          q.id === msg.questionId ? { ...q, value: msg.value, source: "user", status: msg.value ? "filled" : "needs-you" } : q
        );
        await pushState(tabId);
      }
      if (msg.type === "open-panel") {
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
        const snap = snapshots.get(tabId);
        if (!snap) return;
        sendToTab(tabId, { type: "fill-plans", plans: planPage(snap.questions, profile) });
      }
      if (msg.type === "fill-one" || msg.type === "edit-value") {
        sendToTab(tabId, { type: "fill-one", questionId: msg.questionId, value: msg.value });
      }
      if (msg.type === "insert-draft") {
        sendToTab(tabId, { type: "fill-one", questionId: msg.questionId, value: msg.text });
      }
      if (msg.type === "focus") sendToTab(tabId, { type: "focus", questionId: msg.questionId });
      if (msg.type === "undo") sendToTab(tabId, { type: "undo", questionId: msg.questionId });
      if (msg.type === "pause") {
        const origin = msg.origin || (tab?.url ? new URL(tab.url).origin : "");
        const { pausedOrigins = [] } = await chrome.storage.local.get(["pausedOrigins"]);
        const next = new Set(pausedOrigins as string[]);
        if (next.has(origin)) next.delete(origin);
        else next.add(origin);
        await chrome.storage.local.set({ pausedOrigins: [...next] });
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
  const snap = snapshots.get(tabId);
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
}

function looksApply(url?: string) {
  return Boolean(url && (isSupportedApplyUrl(url) || looksLikeApplicationPage(url)) && !shouldBlockPage(url));
}

function looksKeepTab(url?: string) {
  return looksApply(url) || /accounts\.google\.com/i.test(url || "");
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
});

chrome.webNavigation?.onCompleted.addListener((d) => {
  if (d.frameId === 0) ping(d.tabId, d.url);
});
chrome.webNavigation?.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId === 0) ping(d.tabId, d.url);
});

function startLiveAlarm() {
  chrome.alarms.create("fillglen-live", { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["profile"], (r) => {
    if (!r.profile) chrome.storage.local.set({ profile: EMPTY_PROFILE });
  });
  startLiveAlarm();
  harvestLiveJobs().catch(() => {});
});
chrome.runtime.onStartup?.addListener(() => {
  startLiveAlarm();
  harvestLiveJobs().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
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
  return undefined;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fillglen-live") {
    harvestLiveJobs().catch(() => {});
    return;
  }
  if (alarm.name !== "fillglen-keep") return;
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying) return;
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (t.id && looksKeepTab(t.url)) sendToTab(t.id, { type: "keep-tick" });
      }
    });
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
  return queue;
}

async function openLiveJob(url: string) {
  const { liveJobs = [] } = await chrome.storage.local.get(["liveJobs"]);
  await chrome.storage.local.set({
    liveJobs: markLiveJob(liveJobs as ApplyQueueItem[], url, { openedAt: new Date().toISOString() }),
  });
  await chrome.tabs.create({ url });
}

async function setKeepApplying(on: boolean, tabId?: number | null) {
  await chrome.storage.local.set({ keepApplying: on });
  if (on) {
    chrome.alarms.create("fillglen-keep", { periodInMinutes: 1 });
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#d9763a" });
    startLiveAlarm();
    const queue = await harvestLiveJobs();
    runDiscoverTick().then(() => harvestLiveJobs()).catch(() => {});
    const [tab] = tabId
      ? [await chrome.tabs.get(tabId).catch(() => null)]
      : await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const id = tab?.id;
    if (id) sendToTab(id, { type: "keep-tick" });
    const url = tab?.url || "";
    if (id && !looksApply(url) && queue[0]) chrome.tabs.update(id, { url: queue[0].url });
  } else {
    await chrome.alarms.clear("fillglen-keep");
    chrome.action.setBadgeText({ text: "" });
    const { status } = await loadDiscover();
    await chrome.storage.local.set({
      discoverStatus: { ...status, running: false, note: "Discovery paused. Turn keep applying back on to continue the Texas map scan." },
    });
  }
}

startLiveAlarm();

async function onKeepStatus(tabId: number, status: KeepStatus, currentUrl?: string, _detail?: string) {
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
  if (status === "blocked" || status === "submitted" || status === "stuck" || status === "done-job") {
    if (currentUrl && status === "submitted") {
      const { liveJobs = [] } = await chrome.storage.local.get(["liveJobs"]);
      await chrome.storage.local.set({
        liveJobs: markLiveJob(liveJobs as ApplyQueueItem[], currentUrl, { appliedAt: new Date().toISOString() }),
      });
    }
    const next = nextQueueItem(applyQueue, currentUrl || "");
    const url = next?.url || applyQueue[0]?.url;
    if (url && canonicalJobUrl(url) !== canonicalJobUrl(currentUrl || "")) {
      setTimeout(() => chrome.tabs.update(tabId, { url }), 280);
    }
  }
}
