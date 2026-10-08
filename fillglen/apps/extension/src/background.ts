import {
  adapterFor,
  EMPTY_PROFILE,
  isSupportedApplyUrl,
  planPage,
  shouldBlockPage,
  type Profile,
  type ScanSnapshot,
} from "@fillglen/core";
import type { FromPanel, ToBackground, ToContent, ToPanel } from "./shared/messages";

const contentPorts = new Map<number, Set<chrome.runtime.Port>>();
const panelPorts = new Set<chrome.runtime.Port>();
const snapshots = new Map<number, ScanSnapshot>();

async function loadProfile(): Promise<Profile> {
  const stored = await chrome.storage.local.get(["profile"]);
  return (stored.profile as Profile) || EMPTY_PROFILE;
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
  broadcastPanel({ type: "state", snapshot, profile, paused, tabId });
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
      if (msg.type === "fill-one" || msg.type === "insert-draft" || msg.type === "edit-value") {
        sendToTab(tabId, { type: "fill-one", questionId: msg.questionId, value: msg.value ?? (msg as { text?: string }).text ?? "" });
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
  return Boolean(url && isSupportedApplyUrl(url) && !shouldBlockPage(url));
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["profile"], (r) => {
    if (!r.profile) chrome.storage.local.set({ profile: EMPTY_PROFILE });
  });
});
