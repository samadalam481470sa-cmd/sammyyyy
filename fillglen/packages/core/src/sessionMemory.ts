import { canonicalJobUrl } from "./applyLoop.js";
import type { Question, ScanSnapshot } from "./types.js";

export const SESSION_ACTION_CAP = 500;
export const SESSION_TAB_CAP = 40;

export interface SessionAction {
  id: string;
  at: string;
  type: string;
  url: string;
  title: string;
  company: string;
  detail: string;
}

export interface PageKeepState {
  url: string;
  stuckTicks: number;
  googleClicked: boolean;
  waitingOnCaptcha: boolean;
  undoStack: { id: string; prev: string }[];
  clickedSubmitAt?: number;
  leavingJob?: boolean;
  savedAt: string;
}

export interface SessionMemory {
  tabs: Record<string, ScanSnapshot & { savedAt: string; tabId?: number }>;
  byTabId: Record<string, string>;
  pageKeep: Record<string, PageKeepState>;
  actions: SessionAction[];
  lastTabId: number | null;
  lastUrl: string;
  keepStatus: string;
  keepDetail: string;
  warmupUrl: string | null;
  warmupTabId: number | null;
  handedOffTabIds: number[];
  lastActiveAt: string;
}

export const EMPTY_SESSION: SessionMemory = {
  tabs: {},
  byTabId: {},
  pageKeep: {},
  actions: [],
  lastTabId: null,
  lastUrl: "",
  keepStatus: "",
  keepDetail: "",
  warmupUrl: null,
  warmupTabId: null,
  handedOffTabIds: [],
  lastActiveAt: "",
};

function nowIso() {
  return new Date().toISOString();
}

function urlKey(url: string): string {
  return canonicalJobUrl(url) || url;
}

function capRecord<T extends { savedAt?: string }>(record: Record<string, T>, cap: number): Record<string, T> {
  const keys = Object.keys(record);
  if (keys.length <= cap) return record;
  const ordered = keys.sort((a, b) => (record[a].savedAt || "").localeCompare(record[b].savedAt || ""));
  const next = { ...record };
  for (const drop of ordered.slice(0, keys.length - cap)) delete next[drop];
  return next;
}

export function compactSnapshot(snap: ScanSnapshot, tabId?: number): ScanSnapshot & { savedAt: string; tabId?: number } {
  return {
    tabId: tabId ?? snap.tabId,
    blockedReason: snap.blockedReason,
    job: {
      ...snap.job,
      description: (snap.job.description || "").slice(0, 2500),
    },
    questions: (snap.questions || []).map((q) => ({
      ...q,
      options: q.options?.slice(0, 40),
    })),
    savedAt: nowIso(),
  };
}

export function putTabSnapshot(mem: SessionMemory, snap: ScanSnapshot, tabId?: number): SessionMemory {
  const saved = compactSnapshot(snap, tabId);
  const url = saved.job?.url || "";
  const key = urlKey(url);
  if (!key) return mem;
  const tabs = capRecord({ ...mem.tabs, [key]: saved }, SESSION_TAB_CAP);
  const byTabId = { ...mem.byTabId };
  if (tabId != null && tabId > 0) byTabId[String(tabId)] = key;
  return {
    ...mem,
    tabs,
    byTabId,
    lastTabId: tabId != null && tabId > 0 ? tabId : mem.lastTabId,
    lastUrl: url || mem.lastUrl,
    lastActiveAt: saved.savedAt,
  };
}

export function snapshotForTab(mem: SessionMemory, tabId: number, url?: string): ScanSnapshot | undefined {
  const fromId = mem.byTabId[String(tabId)];
  if (fromId && mem.tabs[fromId]) return mem.tabs[fromId];
  if (url) {
    const key = urlKey(url);
    if (mem.tabs[key]) return mem.tabs[key];
  }
  return undefined;
}

export function snapshotForUrl(mem: SessionMemory, url: string): ScanSnapshot | undefined {
  const key = urlKey(url);
  return mem.tabs[key] || mem.tabs[url];
}

export function lastSnapshot(mem: SessionMemory): ScanSnapshot | undefined {
  if (mem.lastTabId != null) {
    const fromTab = snapshotForTab(mem, mem.lastTabId, mem.lastUrl);
    if (fromTab) return fromTab;
  }
  if (mem.lastUrl) return snapshotForUrl(mem, mem.lastUrl);
  const keys = Object.keys(mem.tabs);
  if (!keys.length) return undefined;
  return mem.tabs[keys.sort((a, b) => (mem.tabs[b].savedAt || "").localeCompare(mem.tabs[a].savedAt || ""))[0]];
}

export function snapshotsFromSession(mem: SessionMemory): Array<{ tabId: number; snap: ScanSnapshot }> {
  const out: Array<{ tabId: number; snap: ScanSnapshot }> = [];
  for (const [id, key] of Object.entries(mem.byTabId)) {
    const n = Number(id);
    const snap = mem.tabs[key];
    if (snap && Number.isFinite(n) && n > 0) out.push({ tabId: n, snap });
  }
  return out;
}

export function forgetTabId(mem: SessionMemory, tabId: number): SessionMemory {
  const byTabId = { ...mem.byTabId };
  delete byTabId[String(tabId)];
  return {
    ...mem,
    byTabId,
    handedOffTabIds: mem.handedOffTabIds.filter((id) => id !== tabId),
    warmupTabId: mem.warmupTabId === tabId ? null : mem.warmupTabId,
    warmupUrl: mem.warmupTabId === tabId ? null : mem.warmupUrl,
    lastTabId: mem.lastTabId === tabId ? null : mem.lastTabId,
    lastActiveAt: nowIso(),
  };
}

export function appendAction(
  mem: SessionMemory,
  action: Omit<SessionAction, "id"> & { id?: string }
): SessionMemory {
  const row: SessionAction = {
    id: action.id || `${action.at}:${action.type}:${urlKey(action.url || "")}`.slice(0, 240),
    at: action.at || nowIso(),
    type: action.type,
    url: action.url || "",
    title: action.title || "",
    company: action.company || "",
    detail: (action.detail || "").slice(0, 500),
  };
  const actions = [...mem.actions, row];
  return {
    ...mem,
    actions: actions.length > SESSION_ACTION_CAP ? actions.slice(-SESSION_ACTION_CAP) : actions,
    lastUrl: row.url || mem.lastUrl,
    lastActiveAt: row.at,
  };
}

export function rememberKeep(
  mem: SessionMemory,
  status: string,
  url: string,
  detail?: string,
  tabId?: number
): SessionMemory {
  return appendAction(
    {
      ...mem,
      keepStatus: status,
      keepDetail: detail || "",
      lastTabId: tabId ?? mem.lastTabId,
      lastUrl: url || mem.lastUrl,
    },
    { at: nowIso(), type: "keep", url, title: "", company: "", detail: detail ? `${status}: ${detail}` : status }
  );
}

export function rememberHandoff(mem: SessionMemory, tabId: number, warmupUrl?: string | null): SessionMemory {
  const ids = mem.handedOffTabIds.includes(tabId) ? mem.handedOffTabIds : [...mem.handedOffTabIds, tabId].slice(-80);
  return { ...mem, handedOffTabIds: ids, warmupUrl: warmupUrl ?? mem.warmupUrl, lastActiveAt: nowIso() };
}

export function rememberWarmup(mem: SessionMemory, tabId: number | null, url: string | null): SessionMemory {
  return { ...mem, warmupTabId: tabId, warmupUrl: url, lastActiveAt: nowIso() };
}

export function rememberPageKeep(mem: SessionMemory, state: Omit<PageKeepState, "savedAt"> & { savedAt?: string }): SessionMemory {
  const key = urlKey(state.url);
  if (!key) return mem;
  const saved: PageKeepState = {
    url: state.url,
    stuckTicks: state.stuckTicks || 0,
    googleClicked: Boolean(state.googleClicked),
    waitingOnCaptcha: Boolean(state.waitingOnCaptcha),
    undoStack: (state.undoStack || []).slice(-80),
    clickedSubmitAt: state.clickedSubmitAt || 0,
    leavingJob: Boolean(state.leavingJob),
    savedAt: state.savedAt || nowIso(),
  };
  return {
    ...mem,
    pageKeep: capRecord({ ...mem.pageKeep, [key]: saved }, SESSION_TAB_CAP),
    lastUrl: state.url || mem.lastUrl,
    lastActiveAt: saved.savedAt,
  };
}

export function pageKeepForUrl(mem: SessionMemory, url: string): PageKeepState | undefined {
  const key = urlKey(url);
  return mem.pageKeep[key] || mem.pageKeep[url];
}

export function overlaySavedValues(current: Question[], saved: Question[]): Question[] {
  if (!saved.length) return current;
  const byId = new Map(saved.map((q) => [q.id, q]));
  const byLabel = new Map(saved.filter((q) => q.label).map((q) => [q.label.toLowerCase(), q]));
  return current.map((q) => {
    const prev = byId.get(q.id) || byLabel.get((q.label || "").toLowerCase());
    if (!prev?.value || q.value) return q;
    return { ...q, value: prev.value, source: prev.source || "user", status: "filled" };
  });
}

export function hydrateSession(raw: unknown): SessionMemory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SESSION };
  const r = raw as Partial<SessionMemory>;
  return {
    ...EMPTY_SESSION,
    tabs: r.tabs && typeof r.tabs === "object" ? r.tabs : {},
    byTabId: r.byTabId && typeof r.byTabId === "object" ? r.byTabId : {},
    pageKeep: r.pageKeep && typeof r.pageKeep === "object" ? r.pageKeep : {},
    actions: Array.isArray(r.actions) ? r.actions : [],
    lastTabId: typeof r.lastTabId === "number" ? r.lastTabId : null,
    lastUrl: r.lastUrl || "",
    keepStatus: r.keepStatus || "",
    keepDetail: r.keepDetail || "",
    warmupUrl: r.warmupUrl || null,
    warmupTabId: typeof r.warmupTabId === "number" ? r.warmupTabId : null,
    handedOffTabIds: Array.isArray(r.handedOffTabIds) ? r.handedOffTabIds : [],
    lastActiveAt: r.lastActiveAt || "",
  };
}
