import { useEffect, useState } from "react";
import {
  EMPTY_DB_STATS,
  isDbKind,
  listingRecord,
  putLocalRecords,
  queryLocalStore,
  type DbKind,
  type DbQueryResult,
  type DbRecord,
  type DbStats,
} from "@fillglen/core";
import { api, token } from "../api";
import { usePersistedState } from "../persist";

const KINDS = ["", "job", "employer", "application", "harvest", "answer"] as const;

export default function DatabasePage() {
  const [q, setQ] = usePersistedState("database-q", "");
  const [kind, setKind] = usePersistedState("database-kind", "");
  const [status, setStatus] = usePersistedState("database-status", "");
  const [note, setNote] = usePersistedState("database-note", "");
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [stats, setStats] = useState<DbStats>(EMPTY_DB_STATS);
  const [busy, setBusy] = useState(false);

  async function syncFromApi() {
    try {
      const remote = await api("/v1/database/search?limit=200");
      if (Array.isArray(remote.rows) && remote.rows.length) await putLocalRecords(remote.rows);
    } catch {
      /* API may be offline; IndexedDB still answers */
    }
    if (token()) {
      try {
        const ranked = await api("/v1/finder/jobs");
        const rows = (ranked.jobs || []).map((j: Record<string, unknown>) =>
          listingRecord({
            id: String(j.id || j.url),
            title: String(j.title || "Job"),
            company: String(j.company || ""),
            locationText: String(j.locationText || ""),
            lat: (j.lat as number | null) ?? null,
            lng: (j.lng as number | null) ?? null,
            workMode: (j.workMode as "onsite" | "hybrid" | "remote") || "onsite",
            description: String(j.description || j.why || ""),
            url: String(j.url || ""),
            source: String(j.source || ""),
            sources: [{ source: String(j.source || "unknown"), url: String(j.url || "") }],
            firstSeenAt: String(j.firstSeenAt || new Date().toISOString()),
            lastCheckedAt: String(j.lastCheckedAt || new Date().toISOString()),
            status: (j.status as "open" | "closed") || "open",
          })
        );
        if (rows.length) await putLocalRecords(rows);
      } catch {
        /* still local */
      }
    }
  }

  async function fetchRows() {
    setBusy(true);
    try {
      await syncFromApi();
      const kindFilter: DbKind | undefined = isDbKind(kind) ? kind : undefined;
      const local = await queryLocalStore({
        q,
        kind: kindFilter,
        status: status || undefined,
        limit: 80,
      });
      setResult(local);
      setStats(local.stats);
      setNote(`${local.stats.total} stored in this browser. ${local.total} match this fetch.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not fetch the database.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetchRows().catch(() => {});
    const timer = setInterval(() => fetchRows().catch(() => {}), 30_000);
    return () => clearInterval(timer);
    // First paint + 30s refresh. Typing should not retrigger until Fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = result?.rows || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Database</h1>
          <p className="text-sm text-[#5c6b64]">
            Jobs, employers, applications, and harvest ticks live in this browser. The API finder writes the same
            records 24/7; this page copies them here so fetch still works offline.
          </p>
        </div>
        <button className="bg-pine text-cream px-3 py-2 rounded-lg" disabled={busy} onClick={() => fetchRows()}>
          Fetch now
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Stored" value={stats.total} />
        <Stat label="Jobs" value={stats.byKind.job || 0} />
        <Stat label="Companies" value={stats.companies} />
        <Stat label="Harvest ticks" value={stats.harvestCount} />
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-[12rem]">
          Fetch
          <input
            value={q}
            placeholder="title, company, greenhouse, Dallas…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchRows();
            }}
          />
        </label>
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k || "all"} value={k}>
                {k || "All"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <input value={status} placeholder="open" onChange={(e) => setStatus(e.target.value)} />
        </label>
        <button className="bg-pine text-cream px-3 py-2 rounded-lg" disabled={busy} onClick={() => fetchRows()}>
          Fetch
        </button>
      </div>
      {note ? <p className="text-sm text-[#5c6b64]">{note}</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </ul>
      {!rows.length ? <p className="text-sm text-[#5c6b64]">Nothing stored for this fetch yet. Run the 24/7 finder or keep the extension open.</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl p-5">
      <div className="text-sm text-[#5c6b64]">{label}</div>
      <div className="text-2xl mt-1">{value}</div>
    </div>
  );
}

function Row({ row }: { row: DbRecord }) {
  return (
    <li className="border border-[#d9d0c4] rounded-xl p-3 bg-[#fffbf5]">
      <div className="flex justify-between gap-2">
        {row.url ? (
          <a href={row.url} target="_blank" rel="noreferrer" className="font-medium">
            {row.title}
          </a>
        ) : (
          <span className="font-medium">{row.title}</span>
        )}
        <span className="text-sm text-[#5c6b64]">{row.kind}</span>
      </div>
      <p className="text-sm text-[#5c6b64]">
        {[row.company, row.location, row.source, row.status, row.score != null ? String(row.score) : ""]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {row.why ? <p className="text-sm mt-1">{row.why}</p> : null}
      <p className="text-xs mt-1">Last seen {row.lastSeenAt?.slice(0, 19).replace("T", " ")}</p>
    </li>
  );
}
