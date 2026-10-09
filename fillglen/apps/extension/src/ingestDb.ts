import {
  answerRecord,
  applicationRecord,
  compactDbCache,
  harvestRecord,
  jobRecord,
  seedEmployerRecords,
  localDbStats,
  parseDbQuery,
  putLocalRecords,
  queryLocalStore,
  queryRecords,
  type ApplyQueueItem,
  type DbQuery,
  type DbQueryResult,
  type DbRecord,
  type DbStats,
  type EmployerRecord,
  type Profile,
} from "@fillglen/core";

export type DbCache = ReturnType<typeof compactDbCache>;

function asJobs(value: unknown): ApplyQueueItem[] {
  return Array.isArray(value) ? (value as ApplyQueueItem[]) : [];
}

export async function ingestFromStorage(extra: DbRecord[] = []): Promise<DbStats> {
  const stored = await chrome.storage.local.get([
    "liveJobs",
    "applyQueue",
    "discoveredEmployers",
    "applications",
    "jobs",
    "profile",
  ]);
  const records: DbRecord[] = [...extra];
  for (const job of asJobs(stored.liveJobs)) records.push(jobRecord(job));
  for (const job of asJobs(stored.applyQueue)) records.push(jobRecord(job));
  for (const emp of seedEmployerRecords((stored.discoveredEmployers as EmployerRecord[]) || [])) {
    records.push(emp);
  }
  const jobs = (stored.jobs as { id?: string; title?: string; company?: string; url?: string; board?: string }[]) || [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  for (const app of (stored.applications as { id?: string; jobId?: string; status?: string; createdAt?: string; appliedAt?: string | null }[]) || []) {
    const job = jobById.get(app.jobId);
    records.push(
      applicationRecord({
        ...app,
        title: job?.title,
        company: job?.company,
        url: job?.url,
        board: job?.board,
      })
    );
  }
  const profile = stored.profile as Profile | undefined;
  for (const ans of profile?.answers || []) {
    const row = answerRecord(ans);
    if (row.kind === "answer" && (ans.tags?.includes("eeo") || ans.tags?.includes("contact"))) continue;
    records.push(row);
  }
  await putLocalRecords(records);
  const stats = await localDbStats();
  await chrome.storage.local.set({
    dbCache: compactDbCache(stats),
    dbHarvestedAt: new Date().toISOString(),
  });
  return stats;
}

export async function recordHarvestTick(queueCount: number, storedCount: number) {
  const tick = harvestRecord({
    fetched: queueCount,
    stored: storedCount,
    via: "extension",
    note: `extension harvest fetched=${queueCount} live=${storedCount}`,
  });
  return ingestFromStorage([tick]);
}

export async function runDbQuery(raw: Record<string, unknown> = {}): Promise<DbQueryResult> {
  const query = parseDbQuery(raw);
  try {
    return await queryLocalStore(query);
  } catch {
    const { liveJobs = [], applyQueue = [], discoveredEmployers = [] } = await chrome.storage.local.get([
      "liveJobs",
      "applyQueue",
      "discoveredEmployers",
    ]);
    const fallback: DbRecord[] = [
      ...asJobs(liveJobs).map(jobRecord),
      ...asJobs(applyQueue).map(jobRecord),
      ...seedEmployerRecords((discoveredEmployers as EmployerRecord[]) || []),
    ];
    return queryRecords(fallback, query);
  }
}

export async function runDbStats(): Promise<DbStats> {
  try {
    return await localDbStats();
  } catch {
    const { dbCache } = await chrome.storage.local.get(["dbCache"]);
    if (dbCache) {
      return {
        total: dbCache.total || 0,
        byKind: dbCache.byKind || {},
        bySource: {},
        byStatus: {},
        applied: dbCache.applied || 0,
        opened: 0,
        lastHarvestAt: dbCache.lastHarvestAt || null,
        harvestCount: dbCache.harvestCount || 0,
        companies: dbCache.companies || 0,
      };
    }
    return {
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
  }
}

export type { DbQuery, DbQueryResult, DbRecord, DbStats };
