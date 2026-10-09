import { canonicalJobUrl, type ApplyQueueItem } from "./applyLoop.js";
import { mergeEmployers, seedEmployers, type CanonicalListing, type EmployerRecord } from "./finder.js";
import { govEmployerSeed } from "./govJobs.js";

/** Kinds stored in the in-app database. Chrome.storage still holds the compact live list. */
export type DbKind = "job" | "employer" | "application" | "harvest" | "event" | "answer";

export const LOCAL_DB_CAP = 50_000;
export const LOCAL_DB_NAME = "fillglen-local";
export const LOCAL_DB_STORE = "records";
export const LOCAL_DB_VERSION = 1;

export interface DbRecord {
  id: string;
  kind: DbKind;
  title: string;
  company: string;
  url: string;
  location: string;
  source: string;
  score: number | null;
  why: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  openedAt?: string;
  appliedAt?: string;
  text: string;
  meta: Record<string, unknown>;
}

export interface DbQuery {
  q?: string;
  kind?: DbKind | DbKind[];
  status?: string;
  company?: string;
  source?: string;
  minScore?: number;
  applied?: boolean;
  opened?: boolean;
  since?: string;
  until?: string;
  sort?: "lastSeenAt" | "firstSeenAt" | "score" | "title" | "company";
  dir?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export interface DbStats {
  total: number;
  byKind: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  applied: number;
  opened: number;
  lastHarvestAt: string | null;
  harvestCount: number;
  companies: number;
}

export interface DbQueryResult {
  rows: DbRecord[];
  total: number;
  stats: DbStats;
  query: DbQuery;
}

export const EMPTY_DB_STATS: DbStats = {
  total: 0,
  byKind: {},
  bySource: {},
  byStatus: {},
  applied: 0,
  opened: 0,
  lastHarvestAt: null,
  harvestCount: 0,
  companies: 0,
};

const KINDS: DbKind[] = ["job", "employer", "application", "harvest", "event", "answer"];

export function isDbKind(value: unknown): value is DbKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

export function isDbRecord(value: unknown): value is DbRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as DbRecord;
  return Boolean(row.id && isDbKind(row.kind) && typeof row.title === "string");
}

export function recordId(kind: DbKind, key: string): string {
  const k = String(key || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${kind}:${k}`.slice(0, 350);
}

function blob(parts: unknown[]): string {
  return parts
    .flat()
    .filter((p) => p != null && p !== "")
    .map((p) => String(p))
    .join(" ")
    .toLowerCase();
}

export function jobRecord(item: ApplyQueueItem): DbRecord {
  const now = new Date().toISOString();
  const url = item.url || "";
  const status = item.appliedAt ? "applied" : item.openedAt ? "opened" : "open";
  return {
    id: recordId("job", canonicalJobUrl(url) || url),
    kind: "job",
    title: item.title || "Job",
    company: item.company || "",
    url,
    location: item.location || "",
    source: item.source || "",
    score: item.score ?? null,
    why: item.why || "",
    status,
    firstSeenAt: item.firstSeenAt || now,
    lastSeenAt: item.lastSeenAt || now,
    openedAt: item.openedAt,
    appliedAt: item.appliedAt,
    text: blob([item.title, item.company, item.location, item.source, item.why, url]),
    meta: { ...item },
  };
}

export function listingRecord(listing: CanonicalListing): DbRecord {
  return {
    id: recordId("job", canonicalJobUrl(listing.url) || listing.id || listing.url),
    kind: "job",
    title: listing.title || "Job",
    company: listing.company || "",
    url: listing.url || "",
    location: listing.locationText || "",
    source: String(listing.source || ""),
    score: null,
    why: "",
    status: listing.status || "open",
    firstSeenAt: listing.firstSeenAt,
    lastSeenAt: listing.lastCheckedAt || listing.firstSeenAt,
    text: blob([listing.title, listing.company, listing.locationText, listing.source, listing.description, listing.url]),
    meta: {
      listingId: listing.id,
      workMode: listing.workMode,
      description: listing.description,
      lat: listing.lat,
      lng: listing.lng,
      postedAt: listing.postedAt,
    },
  };
}

export function employerRecord(emp: EmployerRecord): DbRecord {
  const key = `${emp.board || ""}:${emp.slug || ""}:${emp.company || ""}:${emp.careersUrl || ""}`;
  const now = new Date().toISOString();
  return {
    id: recordId("employer", key),
    kind: "employer",
    title: emp.company || "Employer",
    company: emp.company || "",
    url: emp.careersUrl || "",
    location: emp.metro || emp.hqHint || "",
    source: String(emp.board || emp.sourceKind || ""),
    score: null,
    why: emp.sourceKind || "",
    status: "mapped",
    firstSeenAt: now,
    lastSeenAt: now,
    text: blob([emp.company, emp.metro, emp.board, emp.slug, emp.careersUrl, emp.sourceKind]),
    meta: { ...emp },
  };
}

/** Built-in employer seed so the extension database is full without a website. */
export function seedEmployerRecords(extra: EmployerRecord[] = []): DbRecord[] {
  return mergeEmployers(seedEmployers(extra), govEmployerSeed()).map(employerRecord);
}

export function harvestRecord(tick: {
  at?: string;
  fetched?: number;
  stored?: number;
  closed?: number;
  maps?: number;
  note?: string;
  via?: string;
}): DbRecord {
  const at = tick.at || new Date().toISOString();
  const note = tick.note || `fetched ${tick.fetched ?? 0}, stored ${tick.stored ?? 0}`;
  return {
    id: recordId("harvest", `${tick.via || "tick"}:${at}`),
    kind: "harvest",
    title: "Harvest tick",
    company: "",
    url: "",
    location: "",
    source: tick.via || "finder",
    score: tick.stored ?? tick.fetched ?? null,
    why: note,
    status: "tick",
    firstSeenAt: at,
    lastSeenAt: at,
    text: blob(["harvest", tick.via, note, at]),
    meta: { ...tick, at },
  };
}

export function applicationRecord(input: {
  id?: string;
  jobId?: string;
  status?: string;
  createdAt?: string;
  appliedAt?: string | null;
  title?: string;
  company?: string;
  url?: string;
  board?: string;
}): DbRecord {
  const url = input.url || "";
  const created = input.createdAt || new Date().toISOString();
  const status = input.appliedAt ? "applied" : input.status || "saved";
  return {
    id: recordId("application", input.id || input.jobId || canonicalJobUrl(url) || url || created),
    kind: "application",
    title: input.title || "Application",
    company: input.company || "",
    url,
    location: "",
    source: input.board || "",
    score: null,
    why: status,
    status,
    firstSeenAt: created,
    lastSeenAt: input.appliedAt || created,
    appliedAt: input.appliedAt || undefined,
    text: blob([input.title, input.company, url, status, input.board]),
    meta: { ...input },
  };
}

export function answerRecord(input: { id?: string; pattern: string; answer: string; tags?: string[] }): DbRecord {
  const now = new Date().toISOString();
  return {
    id: recordId("answer", input.id || input.pattern),
    kind: "answer",
    title: input.pattern,
    company: "",
    url: "",
    location: "",
    source: "saved",
    score: null,
    why: input.answer,
    status: "saved",
    firstSeenAt: now,
    lastSeenAt: now,
    text: blob([input.pattern, input.answer, ...(input.tags || [])]),
    meta: { ...input },
  };
}

export function eventRecord(input: { id?: string; status: string; at?: string; applicationId?: string; detail?: string }): DbRecord {
  const at = input.at || new Date().toISOString();
  return {
    id: recordId("event", input.id || `${input.applicationId || "app"}:${input.status}:${at}`),
    kind: "event",
    title: input.status,
    company: "",
    url: "",
    location: "",
    source: "tracker",
    score: null,
    why: input.detail || "",
    status: input.status,
    firstSeenAt: at,
    lastSeenAt: at,
    text: blob([input.status, input.detail, input.applicationId, at]),
    meta: { ...input },
  };
}

export function mergeRecord(prev: DbRecord | undefined, incoming: DbRecord): DbRecord {
  if (!prev) return incoming;
  return {
    ...prev,
    ...incoming,
    id: incoming.id || prev.id,
    firstSeenAt: prev.firstSeenAt || incoming.firstSeenAt,
    lastSeenAt: incoming.lastSeenAt || prev.lastSeenAt,
    openedAt: incoming.openedAt || prev.openedAt,
    appliedAt: incoming.appliedAt || prev.appliedAt,
    score: incoming.score ?? prev.score,
    why: incoming.why || prev.why,
    text: incoming.text || prev.text,
    meta: { ...prev.meta, ...incoming.meta },
  };
}

function keepRank(row: DbRecord): number {
  if (row.kind === "application" || row.appliedAt) return 0;
  if (row.openedAt) return 1;
  if (row.kind === "job") return 2;
  if (row.kind === "answer") return 3;
  if (row.kind === "employer") return 4;
  if (row.kind === "event") return 5;
  return 6;
}

export function trimRecords(records: DbRecord[], cap = LOCAL_DB_CAP): DbRecord[] {
  if (records.length <= cap) return records;
  return [...records]
    .sort((a, b) => keepRank(a) - keepRank(b) || (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""))
    .slice(0, cap);
}

export function upsertRecords(existing: DbRecord[], incoming: DbRecord[], cap = LOCAL_DB_CAP): DbRecord[] {
  const map = new Map<string, DbRecord>();
  for (const row of existing) {
    if (row?.id) map.set(row.id, row);
  }
  for (const row of incoming) {
    if (!row?.id) continue;
    map.set(row.id, mergeRecord(map.get(row.id), row));
  }
  return trimRecords([...map.values()], cap);
}

export function dbStats(records: DbRecord[]): DbStats {
  const stats: DbStats = {
    total: records.length,
    byKind: {},
    bySource: {},
    byStatus: {},
    applied: 0,
    opened: 0,
    lastHarvestAt: null,
    harvestCount: 0,
    companies: 0,
  };
  const companies = new Set<string>();
  for (const row of records) {
    stats.byKind[row.kind] = (stats.byKind[row.kind] || 0) + 1;
    if (row.source) stats.bySource[row.source] = (stats.bySource[row.source] || 0) + 1;
    if (row.status) stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1;
    if (row.appliedAt || row.status === "applied") stats.applied += 1;
    if (row.openedAt || row.status === "opened") stats.opened += 1;
    if (row.kind === "harvest") {
      stats.harvestCount += 1;
      if (!stats.lastHarvestAt || row.lastSeenAt > stats.lastHarvestAt) stats.lastHarvestAt = row.lastSeenAt;
    }
    if (row.company) companies.add(row.company.toLowerCase());
  }
  stats.companies = companies.size;
  return stats;
}

function kindsOf(query: DbQuery): DbKind[] | null {
  if (!query.kind) return null;
  return Array.isArray(query.kind) ? query.kind : [query.kind];
}

function matches(row: DbRecord, query: DbQuery): boolean {
  const kinds = kindsOf(query);
  if (kinds && !kinds.includes(row.kind)) return false;
  if (query.status && row.status !== query.status) return false;
  if (query.company && !row.company.toLowerCase().includes(query.company.toLowerCase())) return false;
  if (query.source && !row.source.toLowerCase().includes(query.source.toLowerCase())) return false;
  if (query.minScore != null && (row.score == null || row.score < query.minScore)) return false;
  if (query.applied === true && !(row.appliedAt || row.status === "applied")) return false;
  if (query.applied === false && (row.appliedAt || row.status === "applied")) return false;
  if (query.opened === true && !(row.openedAt || row.status === "opened")) return false;
  if (query.opened === false && (row.openedAt || row.status === "opened")) return false;
  if (query.since && (row.lastSeenAt || "") < query.since) return false;
  if (query.until && (row.lastSeenAt || "") > query.until) return false;
  const q = (query.q || "").trim().toLowerCase();
  if (q) {
    const hay = `${row.text} ${row.title} ${row.company} ${row.url} ${row.location} ${row.source} ${row.why} ${row.status}`.toLowerCase();
    for (const token of q.split(/\s+/)) {
      if (token && !hay.includes(token)) return false;
    }
  }
  return true;
}

function compareRows(a: DbRecord, b: DbRecord, sort: DbQuery["sort"], dir: "asc" | "desc"): number {
  let av: string | number = "";
  let bv: string | number = "";
  if (sort === "score") {
    av = a.score ?? -1;
    bv = b.score ?? -1;
  } else if (sort === "title") {
    av = a.title.toLowerCase();
    bv = b.title.toLowerCase();
  } else if (sort === "company") {
    av = a.company.toLowerCase();
    bv = b.company.toLowerCase();
  } else if (sort === "firstSeenAt") {
    av = a.firstSeenAt || "";
    bv = b.firstSeenAt || "";
  } else {
    av = a.lastSeenAt || "";
    bv = b.lastSeenAt || "";
  }
  if (av < bv) return dir === "asc" ? -1 : 1;
  if (av > bv) return dir === "asc" ? 1 : -1;
  return 0;
}

export function queryRecords(records: DbRecord[], query: DbQuery = {}): DbQueryResult {
  const offset = Math.max(0, query.offset || 0);
  const limit = Math.min(500, Math.max(0, query.limit == null ? 50 : query.limit));
  const sort = query.sort || "lastSeenAt";
  const dir = query.dir || "desc";
  const matched = records.filter((row) => matches(row, query)).sort((a, b) => compareRows(a, b, sort, dir));
  return {
    rows: matched.slice(offset, offset + limit),
    total: matched.length,
    stats: dbStats(records),
    query: { ...query, offset, limit, sort, dir },
  };
}

function asRecord(raw: Record<string, unknown> | URLSearchParams | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof (raw as URLSearchParams).get === "function") {
    const out: Record<string, unknown> = {};
    (raw as URLSearchParams).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return raw as Record<string, unknown>;
}

function str(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value == null || value === "") return undefined;
  return String(value);
}

function num(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function flag(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = str(raw, key);
  if (value == null) return undefined;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

export function parseDbQuery(raw?: Record<string, unknown> | URLSearchParams): DbQuery {
  const input = asRecord(raw);
  const kindRaw = str(input, "kind");
  let kind: DbQuery["kind"];
  if (kindRaw) {
    const parts = kindRaw.split(",").map((p) => p.trim()).filter(isDbKind);
    if (parts.length === 1) kind = parts[0];
    else if (parts.length > 1) kind = parts;
  }
  const sortRaw = str(input, "sort");
  const sort: DbQuery["sort"] =
    sortRaw === "firstSeenAt" || sortRaw === "score" || sortRaw === "title" || sortRaw === "company" || sortRaw === "lastSeenAt"
      ? sortRaw
      : "lastSeenAt";
  return {
    q: str(input, "q") ?? str(input, "query"),
    kind,
    status: str(input, "status"),
    company: str(input, "company"),
    source: str(input, "source"),
    minScore: num(input, "minScore"),
    applied: flag(input, "applied"),
    opened: flag(input, "opened"),
    since: str(input, "since"),
    until: str(input, "until"),
    sort,
    dir: str(input, "dir") === "asc" ? "asc" : "desc",
    offset: num(input, "offset") ?? 0,
    limit: num(input, "limit") ?? 50,
  };
}

export function compactDbCache(stats: DbStats): {
  total: number;
  lastHarvestAt: string | null;
  byKind: Record<string, number>;
  harvestCount: number;
  applied: number;
  companies: number;
} {
  return {
    total: stats.total,
    lastHarvestAt: stats.lastHarvestAt,
    byKind: stats.byKind,
    harvestCount: stats.harvestCount,
    applied: stats.applied,
    companies: stats.companies,
  };
}
