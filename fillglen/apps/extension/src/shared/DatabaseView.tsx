import { useEffect, useState } from "react";
import type { DbQueryResult, DbRecord, DbStats } from "@fillglen/core";
import { EMPTY_DB_STATS } from "@fillglen/core";

const KINDS = ["", "job", "employer", "application", "harvest", "answer"] as const;

type ChromeLite = {
  storage?: {
    local?: {
      get: (keys: string[], cb: (r: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>) => void;
    };
  };
  runtime?: { sendMessage: (msg: unknown) => Promise<unknown> };
};

function chromeApi(): ChromeLite | undefined {
  return (globalThis as { chrome?: ChromeLite }).chrome;
}

const API_BASE =
  (globalThis as { FILLGLEN_API?: string }).FILLGLEN_API ||
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE) ||
  "http://127.0.0.1:8787";

export function DatabaseView({
  onBack,
  persistKey = "popup",
}: {
  onBack: () => void;
  persistKey?: string;
}) {
  const qKey = `${persistKey}DbQ`;
  const kindKey = `${persistKey}DbKind`;
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [stats, setStats] = useState<DbStats>(EMPTY_DB_STATS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const chromeLocal = chromeApi()?.storage?.local;
    if (chromeLocal) {
      chromeLocal.get([qKey, kindKey, "dbCache"], (r) => {
        const nextQ = typeof r[qKey] === "string" ? String(r[qKey]) : "";
        const nextKind = typeof r[kindKey] === "string" ? String(r[kindKey]) : "";
        setQ(nextQ);
        setKind(nextKind);
        const cache = r.dbCache as DbStats | undefined;
        if (cache?.total != null) setStats((s) => ({ ...s, ...cache }));
        fetchRows(nextQ, nextKind).catch(() => {});
      });
      return;
    }
    try {
      const nextQ = localStorage.getItem("fillglen:ui:" + qKey) || "";
      const nextKind = localStorage.getItem("fillglen:ui:" + kindKey) || "";
      setQ(nextQ);
      setKind(nextKind);
      fetchRows(nextQ, nextKind).catch(() => {});
    } catch {
      fetchRows("", "").catch(() => {});
    }
  }, [qKey, kindKey]);

  function persist(nextQ: string, nextKind: string) {
    const chromeLocal = chromeApi()?.storage?.local;
    if (chromeLocal) {
      chromeLocal.set({ [qKey]: nextQ, [kindKey]: nextKind });
      return;
    }
    try {
      localStorage.setItem("fillglen:ui:" + qKey, nextQ);
      localStorage.setItem("fillglen:ui:" + kindKey, nextKind);
    } catch {
      /* quota */
    }
  }

  async function fetchRows(nextQ: string, nextKind: string) {
    const query = { q: nextQ, kind: nextKind || undefined, limit: 40 };
    const runtime = chromeApi()?.runtime;
    if (runtime?.sendMessage) {
      const body = (await runtime.sendMessage({ type: "db-query", query })) as DbQueryResult;
      if (body?.rows) setResult(body);
      if (body?.stats) setStats(body.stats);
      return;
    }
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextKind) params.set("kind", nextKind);
    params.set("limit", "40");
    const res = await fetch(`${API_BASE}/v1/database/search?${params}`);
    const body = (await res.json()) as DbQueryResult;
    if (body?.rows) setResult(body);
    if (body?.stats) setStats(body.stats);
  }

  async function search(nextQ = q, nextKind = kind) {
    setBusy(true);
    persist(nextQ, nextKind);
    try {
      await fetchRows(nextQ, nextKind);
    } finally {
      setBusy(false);
    }
  }

  const rows = result?.rows || [];
  const total = result?.total ?? stats.total;

  return (
    <section className="fg-card">
      <div className="toolbar fg-actions">
        <button onClick={onBack}>Back</button>
        <button className="primary" onClick={() => search()}>
          Database
        </button>
        <button disabled={busy} onClick={() => search()}>
          Fetch
        </button>
      </div>
      <div className="fg-card-head">
        <strong>Database</strong>
        <span>{stats.total} stored · {total} match</span>
      </div>
      <p className="meta">
        Jobs, employers, applications, and harvest ticks stay inside this widget. Search is local — type a title,
        company, city, or ATS. The background harvest keeps writing while Chrome is open.
        {stats.lastHarvestAt ? ` Last write ${new Date(stats.lastHarvestAt).toLocaleTimeString()}.` : ""}
      </p>
      <div className="fg-stats fg-stats-4">
        <div>
          <em>{stats.byKind.job || 0}</em>
          <span>Jobs</span>
        </div>
        <div>
          <em>{stats.companies || 0}</em>
          <span>Companies</span>
        </div>
        <div>
          <em>{stats.applied || 0}</em>
          <span>Applied</span>
        </div>
        <div>
          <em>{stats.harvestCount || 0}</em>
          <span>Harvests</span>
        </div>
      </div>
      <div className="fg-search">
        <input
          value={q}
          placeholder="Fetch: title, company, Texas, greenhouse…"
          onChange={(e) => {
            setQ(e.target.value);
            persist(e.target.value, kind);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
        />
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            persist(q, e.target.value);
            search(q, e.target.value);
          }}
        >
          {KINDS.map((k) => (
            <option key={k || "all"} value={k}>
              {k ? k : "All kinds"}
            </option>
          ))}
        </select>
        <button className="primary" disabled={busy} onClick={() => search()}>
          Fetch
        </button>
      </div>
      <ol className="qlist">
        {rows.map((row) => (
          <DbRow key={row.id} row={row} />
        ))}
      </ol>
      {!rows.length ? <p className="meta">Nothing stored for this fetch yet. Keep Chrome open — harvest fills this list.</p> : null}
    </section>
  );
}

function DbRow({ row }: { row: DbRecord }) {
  return (
    <li className="qrow">
      <a href={row.url || undefined} target="_blank" rel="noreferrer">
        {row.title}
      </a>
      <div className="meta">
        {row.kind}
        {row.company ? ` · ${row.company}` : ""}
        {row.location ? ` · ${row.location}` : ""}
        {row.source ? ` · ${row.source}` : ""}
        {row.score != null ? ` · ${row.score}` : ""}
        {row.status ? ` · ${row.status}` : ""}
      </div>
      {row.why ? <p className="hint">{row.why}</p> : null}
      {row.url ? (
        <div className="toolbar">
          <button
            className="primary"
            onClick={() => {
              const runtime = chromeApi()?.runtime;
              if (runtime?.sendMessage) runtime.sendMessage({ type: "open-live-job", url: row.url });
              else window.open(row.url, "_blank", "noopener");
            }}
          >
            Open
          </button>
        </div>
      ) : null}
    </li>
  );
}
