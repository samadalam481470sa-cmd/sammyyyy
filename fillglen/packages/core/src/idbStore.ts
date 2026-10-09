/**
 * IndexedDB adapter for the in-app database.
 * Works in the extension service worker and the dashboard.
 * Falls back to an in-memory map when IndexedDB is missing (Node tests, private modes).
 */
import {
  LOCAL_DB_CAP,
  LOCAL_DB_NAME,
  LOCAL_DB_STORE,
  LOCAL_DB_VERSION,
  dbStats,
  mergeRecord,
  queryRecords,
  trimRecords,
  type DbQuery,
  type DbQueryResult,
  type DbRecord,
  type DbStats,
} from "./localDb.js";

const memory = new Map<string, DbRecord>();

type Req<T> = {
  result: T;
  error?: { message?: string } | null;
  onsuccess: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onupgradeneeded: ((ev: { target: { result: IdbDb } }) => void) | null;
};

type IdStore = {
  put(value: DbRecord): Req<unknown>;
  get(id: string): Req<DbRecord | undefined>;
  getAll(): Req<DbRecord[]>;
  clear(): Req<unknown>;
  count(): Req<number>;
  createIndex?: (name: string, key: string, opts?: { unique?: boolean }) => void;
};

type IdbDb = {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, opts: { keyPath: string }): IdStore;
  transaction(names: string[], mode: string): {
    objectStore(name: string): IdStore;
    oncomplete: ((ev?: unknown) => void) | null;
    onerror: ((ev?: unknown) => void) | null;
  };
};

function idbFactory(): { open(name: string, version: number): Req<IdbDb> } | null {
  const g = globalThis as unknown as { indexedDB?: { open(name: string, version: number): Req<IdbDb> } };
  return g.indexedDB || null;
}

function wait<T>(req: Req<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(req.error?.message || "IndexedDB request failed"));
  });
}

let dbPromise: Promise<IdbDb | null> | null = null;

export function resetMemoryStore() {
  memory.clear();
  dbPromise = null;
}

function openDb(): Promise<IdbDb | null> {
  const factory = idbFactory();
  if (!factory) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(LOCAL_DB_STORE)) {
          const store = db.createObjectStore(LOCAL_DB_STORE, { keyPath: "id" });
          store.createIndex?.("kind", "kind");
          store.createIndex?.("lastSeenAt", "lastSeenAt");
          store.createIndex?.("company", "company");
          store.createIndex?.("source", "source");
          store.createIndex?.("status", "status");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });
  return dbPromise;
}

function memoryUpsert(incoming: DbRecord[]) {
  for (const row of incoming) {
    if (!row?.id) continue;
    memory.set(row.id, mergeRecord(memory.get(row.id), row));
  }
  const trimmed = trimRecords([...memory.values()], LOCAL_DB_CAP);
  memory.clear();
  for (const row of trimmed) memory.set(row.id, row);
}

export async function putLocalRecords(incoming: DbRecord[]): Promise<number> {
  const rows = incoming.filter((r) => r?.id);
  if (!rows.length) return (await allLocalRecords()).length;
  const db = await openDb().catch(() => null);
  if (!db) {
    memoryUpsert(rows);
    return memory.size;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([LOCAL_DB_STORE], "readwrite");
    const store = tx.objectStore(LOCAL_DB_STORE);
    for (const row of rows) {
      const getReq = store.get(row.id);
      getReq.onsuccess = () => {
        store.put(mergeRecord(getReq.result, row));
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("IndexedDB put failed"));
  });
  const countReq = db.transaction([LOCAL_DB_STORE], "readonly").objectStore(LOCAL_DB_STORE).count();
  const count = await wait(countReq).catch(() => rows.length);
  if (count > LOCAL_DB_CAP) {
    const all = await allLocalRecords();
    await replaceLocalRecords(trimRecords(all, LOCAL_DB_CAP));
    return LOCAL_DB_CAP;
  }
  return count;
}

export async function replaceLocalRecords(rows: DbRecord[]): Promise<void> {
  const db = await openDb().catch(() => null);
  if (!db) {
    memory.clear();
    for (const row of rows) if (row?.id) memory.set(row.id, row);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([LOCAL_DB_STORE], "readwrite");
    const store = tx.objectStore(LOCAL_DB_STORE);
    store.clear();
    for (const row of rows) store.put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("IndexedDB replace failed"));
  });
}

export async function allLocalRecords(): Promise<DbRecord[]> {
  const db = await openDb().catch(() => null);
  if (!db) return [...memory.values()];
  const req = db.transaction([LOCAL_DB_STORE], "readonly").objectStore(LOCAL_DB_STORE).getAll();
  return (await wait(req).catch(() => [...memory.values()])) || [];
}

export async function getLocalRecord(id: string): Promise<DbRecord | undefined> {
  const db = await openDb().catch(() => null);
  if (!db) return memory.get(id);
  const req = db.transaction([LOCAL_DB_STORE], "readonly").objectStore(LOCAL_DB_STORE).get(id);
  return wait(req).catch(() => memory.get(id));
}

export async function queryLocalStore(query: DbQuery = {}): Promise<DbQueryResult> {
  return queryRecords(await allLocalRecords(), query);
}

export async function localDbStats(): Promise<DbStats> {
  return dbStats(await allLocalRecords());
}
