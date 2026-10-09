import {
  appendAction,
  eventRecord,
  forgetTabId,
  hydrateSession,
  lastSnapshot,
  overlaySavedValues,
  pageKeepForUrl,
  putLocalRecords,
  putTabSnapshot,
  rememberHandoff,
  rememberKeep,
  rememberPageKeep,
  rememberWarmup,
  snapshotForTab,
  snapshotForUrl,
  snapshotsFromSession,
  type PageKeepState,
  type ScanSnapshot,
  type SessionAction,
  type SessionMemory,
} from "@fillglen/core";

const KEY = "sessionMemory";
let cache: SessionMemory | null = null;
let chain: Promise<SessionMemory> = Promise.resolve(hydrateSession(null));

async function read(): Promise<SessionMemory> {
  if (cache) return cache;
  const stored = await chrome.storage.local.get([KEY]);
  cache = hydrateSession(stored[KEY]);
  return cache;
}

async function write(next: SessionMemory): Promise<SessionMemory> {
  cache = next;
  const snap = lastSnapshot(next);
  await chrome.storage.local.set({
    [KEY]: next,
    sessionSavedAt: next.lastActiveAt,
    lastKeepStatus: next.keepStatus,
    lastKeepDetail: next.keepDetail,
    lastJobUrl: next.lastUrl,
    lastSnapshot: snap || null,
    lastSnapshotTabId: next.lastTabId,
    warmupUrl: next.warmupUrl,
    warmupTabId: next.warmupTabId,
  });
  return next;
}

function queue(fn: (mem: SessionMemory) => SessionMemory): Promise<SessionMemory> {
  chain = chain.then(async () => write(fn(await read()))).catch(async () => write(fn(await read())));
  return chain;
}

export async function loadSession(): Promise<SessionMemory> {
  return read();
}

export async function saveTabSnapshot(tabId: number, snap: ScanSnapshot): Promise<SessionMemory> {
  return queue((mem) => putTabSnapshot(mem, snap, tabId));
}

export async function saveSnapshot(snap: ScanSnapshot, tabId?: number): Promise<SessionMemory> {
  return queue((mem) => putTabSnapshot(mem, snap, tabId));
}

export async function saveAction(action: Omit<SessionAction, "id"> & { id?: string }): Promise<SessionMemory> {
  const next = await queue((mem) => appendAction(mem, action));
  const row = next.actions.at(-1);
  if (row) {
    putLocalRecords([
      eventRecord({
        id: row.id,
        status: row.type,
        at: row.at,
        detail: `${row.title} ${row.company} ${row.detail} ${row.url}`.trim(),
      }),
    ]).catch(() => {});
  }
  return next;
}

export async function saveKeep(status: string, url: string, detail?: string, tabId?: number): Promise<SessionMemory> {
  return queue((mem) => rememberKeep(mem, status, url, detail, tabId));
}

export async function saveHandoff(tabId: number, warmupUrl?: string | null): Promise<SessionMemory> {
  return queue((mem) => rememberHandoff(mem, tabId, warmupUrl));
}

export async function saveWarmup(tabId: number | null, url: string | null): Promise<SessionMemory> {
  return queue((mem) => rememberWarmup(mem, tabId, url));
}

export async function saveWarmupUrl(url: string | null): Promise<SessionMemory> {
  return queue((mem) => rememberWarmup(mem, url ? mem.warmupTabId : null, url));
}

export async function savePageKeep(state: Omit<PageKeepState, "savedAt"> & { savedAt?: string }): Promise<SessionMemory> {
  return queue((mem) => rememberPageKeep(mem, state));
}

export async function forgetOpenTab(tabId: number): Promise<SessionMemory> {
  return queue((mem) => forgetTabId(mem, tabId));
}

export async function snapshotForOpenTab(tabId: number, url?: string): Promise<ScanSnapshot | undefined> {
  const mem = await read();
  return snapshotForTab(mem, tabId, url) || (url ? snapshotForUrl(mem, url) : undefined);
}

export async function pageKeepForOpenUrl(url: string): Promise<PageKeepState | undefined> {
  const mem = await read();
  return pageKeepForUrl(mem, url);
}

export async function hydrateRuntime(): Promise<{
  snapshots: Array<{ tabId: number; snap: ScanSnapshot }>;
  warmupTabId: number | null;
  warmupUrl: string | null;
  handedOffTabIds: number[];
}> {
  const mem = await read();
  return {
    snapshots: snapshotsFromSession(mem),
    warmupTabId: mem.warmupTabId,
    warmupUrl: mem.warmupUrl,
    handedOffTabIds: mem.handedOffTabIds,
  };
}

export { overlaySavedValues, snapshotForUrl, pageKeepForUrl, lastSnapshot };
