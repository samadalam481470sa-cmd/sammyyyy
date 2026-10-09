import { useEffect, useState } from "react";
import type { DbQueryResult, DbRecord, DbStats } from "@fillglen/core";
import { EMPTY_DB_STATS, isDbKind, queryLocalStore } from "@fillglen/core";

const KINDS = ["", "job", "employer", "application", "harvest", "event", "answer"] as const;

type ChromeLite = {
  storage?: {
    local?: {
      get: (keys: string[], cb: (r: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>) => void;
    };
    onChanged?: {
      addListener: (fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
      removeListener: (fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
    };
  };
  runtime?: { sendMessage: (msg: unknown) => Promise<unknown> };
};

function chromeApi(): ChromeLite | undefined {
  return (globalThis as { chrome?: ChromeLite }).chrome;
}

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
  const [note, setNote] = useState("Stored in this extension. Fetch stays in this window.");

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
        fetchRows(nextQ, nextKind, false).catch(() => {});
      });
    } else {
      fetchRows("", "", false).catch(() => {});
    }
    const onChanged = chromeApi()?.storage?.onChanged;
    if (!onChanged) return;
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local") return;
      const cache = changes.dbCache?.newValue as DbStats | undefined;
      if (cache?.total != null) setStats((s) => ({ ...s, ...cache }));
    };
    onChanged.addListener(onChange);
    return () => onChanged.removeListener(onChange);
  }, [qKey, kindKey]);

  function persist(nextQ: string, nextKind: string) {
    chromeApi()?.storage?.local?.set({ [qKey]: nextQ, [kindKey]: nextKind });
  }

  async function fetchRows(nextQ: string, nextKind: string, harvest: boolean) {
    const query = { q: nextQ, kind: isDbKind(nextKind) ? nextKind : undefined, limit: 80 };
    const runtime = chromeApi()?.runtime;
    if (runtime?.sendMessage) {
      const type = harvest ? "db-refresh" : "db-query";
      const body = (await runtime.sendMessage({ type, query })) as DbQueryResult & { ok?: boolean };
      if (body?.rows) setResult(body);
      if (body?.stats) setStats(body.stats);
      const n = body?.stats?.total ?? body?.total ?? 0;
      setNote(
        harvest
          ? `Looked just now. ${n} stored in this extension.`
          : `${n} stored in this extension. Fetch stays in this window.`
      );
      return;
    }
    const body = await queryLocalStore(query);
    setResult(body);
    setStats(body.stats);
    setNote(`${body.stats.total} stored in this window.`);
  }

  async function search(nextQ = q, nextKind = kind, harvest = false) {
    setBusy(true);
    persist(nextQ, nextKind);
    try {
      await fetchRows(nextQ, nextKind, harvest);
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
        <button className="primary" onClick={() => search(q, kind, false)}>
          Database
        </button>
        <button disabled={busy} onClick={() => search(q, kind, true)}>
          {busy ? "Looking…" : "Fetch"}
        </button>
      </div>
      <div className="fg-card-head">
        <strong>Database</strong>
        <span>{stats.total} in this extension · {total} match</span>
      </div>
      <p className="meta">
        This database runs inside the extension. You do not open another site. Type a title, company, city, or ATS,
        then Fetch. Harvest keeps writing here while Chrome is open.
        {stats.lastHarvestAt ? ` Last write ${new Date(stats.lastHarvestAt).toLocaleTimeString()}.` : ""}
      </p>
      <p className="meta">{note}</p>
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
          placeholder="Fetch in this extension: title, company, Texas…"
          onChange={(e) => {
            setQ(e.target.value);
            persist(e.target.value, kind);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") search(q, kind, true);
          }}
        />
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            persist(q, e.target.value);
            search(q, e.target.value, false);
          }}
        >
          {KINDS.map((k) => (
            <option key={k || "all"} value={k}>
              {k ? k : "All kinds"}
            </option>
          ))}
        </select>
        <button className="primary" disabled={busy} onClick={() => search(q, kind, true)}>
          Fetch
        </button>
      </div>
      <ol className="qlist">
        {rows.map((row) => (
          <DbRow key={row.id} row={row} />
        ))}
      </ol>
      {!rows.length ? (
        <p className="meta">Nothing stored for this fetch yet. Hit Fetch — it looks inside this extension, not a website.</p>
      ) : null}
    </section>
  );
}

function DbRow({ row }: { row: DbRecord }) {
  return (
    <li className="qrow">
      {row.url ? (
        <button
          className="qlabel"
          onClick={() => {
            const runtime = chromeApi()?.runtime;
            if (runtime?.sendMessage) runtime.sendMessage({ type: "open-live-job", url: row.url });
          }}
        >
          {row.title}
        </button>
      ) : (
        <strong>{row.title}</strong>
      )}
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
            onClick={() => chromeApi()?.runtime?.sendMessage({ type: "open-live-job", url: row.url })}
          >
            Open job
          </button>
        </div>
      ) : null}
    </li>
  );
}
