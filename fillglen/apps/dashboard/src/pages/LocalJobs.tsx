import { useEffect, useMemo, useState } from "react";
import { api, token } from "../api";

type JobRow = {
  id: string;
  title: string;
  company: string;
  locationText: string;
  workMode: string;
  url: string;
  source: string;
  firstSeenAt: string;
  lastCheckedAt: string;
  lat: number | null;
  lng: number | null;
  score: number;
  why: string;
  warnings: string[];
  status: string;
};

function Feedback({ listingId }: { listingId: string }) {
  const [reason, setReason] = useState("wrong industry");
  const [done, setDone] = useState("");
  return (
    <div className="flex flex-wrap gap-2 mt-2 text-xs items-center">
      <button
        className="underline"
        onClick={async () => {
          await api("/v1/finder/feedback", { method: "POST", body: JSON.stringify({ listingId, sentiment: "up" }) });
          setDone("Saved thumbs up");
        }}
      >
        Thumbs up
      </button>
      <span>Not interested because…</span>
      <select value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="too senior">too senior</option>
        <option value="wrong location">wrong location</option>
        <option value="wrong industry">wrong industry</option>
        <option value="other">other</option>
      </select>
      <button
        className="underline"
        onClick={async () => {
          await api("/v1/finder/feedback", {
            method: "POST",
            body: JSON.stringify({ listingId, sentiment: "down", reason }),
          });
          setDone("Saved");
        }}
      >
        Thumbs down
      </button>
      {done ? <span>{done}</span> : null}
    </div>
  );
}

function project(lat: number, lng: number) {
  const minLat = 32.55,
    maxLat = 33.28,
    minLng = -97.45,
    maxLng = -96.55;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
}

export default function LocalJobs() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [coverage, setCoverage] = useState<{ mappedCount: number; seedCount: number; unmapped: string[]; note: string } | null>(null);
  const [minScore, setMinScore] = useState(60);
  const [mode, setMode] = useState("all");
  const [msg, setMsg] = useState("");

  async function refresh() {
    if (!token()) return;
    const r = await api("/v1/finder/jobs");
    setJobs(r.jobs || []);
    setCoverage(r.coverage);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const shown = useMemo(
    () =>
      jobs
        .filter((j) => j.score >= minScore && (mode === "all" || j.workMode === mode) && j.status === "open")
        .sort((a, b) => b.score - a.score || b.lastCheckedAt.localeCompare(a.lastCheckedAt)),
    [jobs, minScore, mode]
  );
  const pins = useMemo(
    () =>
      shown.filter((j) => j.lat != null && j.lng != null),
    [shown]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Local jobs</h1>
          <p className="text-sm text-[#5c6b64]">
            Search prefers Texas IT hiring, then other United States roles, from public ATS feeds. LinkedIn, Indeed, and
            Glassdoor are not scraped. This is not every company in Texas — only mapped public boards we can pull.
          </p>
        </div>
        <button
          className="bg-pine text-cream px-3 py-2 rounded-lg"
          onClick={async () => {
            if (!token()) return setMsg("Sign in first.");
            setMsg("Fetching public feeds…");
            const r = await api("/v1/finder/run", { method: "POST", body: "{}" });
            setMsg(`Fetched ${r.fetched}, stored ${r.stored}. ${r.note}`);
            await refresh();
          }}
        >
          Run server fetch now
        </button>
      </div>
      {coverage ? (
        <p className="text-sm">
          US/Texas IT coverage: {coverage.mappedCount} of {coverage.seedCount} seed employers have a public feed we can pull.{" "}
          {coverage.note}
          {coverage.unmapped?.length ? ` Unmapped: ${coverage.unmapped.join(", ")}.` : ""}
        </p>
      ) : (
        <p className="text-sm">
          <a className="underline" href="/signin">
            Sign in
          </a>{" "}
          to load your local feed.
        </p>
      )}
      <div className="flex gap-3 text-sm">
        <label>
          Min score
          <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          {minScore}
        </label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="all">All modes</option>
          <option value="onsite">On-site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </select>
      </div>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="relative h-80 bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl overflow-hidden">
          <div className="absolute inset-3 border border-dashed border-[#d9d0c4] rounded-xl">
            <span className="absolute left-2 top-2 text-xs text-[#5c6b64]">
              DFW map · {pins.length} geocoded pin{pins.length === 1 ? "" : "s"}
            </span>
            {pins.map((j) => {
                const p = project(j.lat!, j.lng!);
                return (
                  <a
                    key={j.id}
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    title={`${j.title} · ${j.company} · ${j.score}`}
                    className="absolute w-3 h-3 rounded-full bg-clay -ml-1.5 -mt-1.5"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  />
                );
              })}
          </div>
        </div>
        <ul className="space-y-3 max-h-80 overflow-auto">
          {shown.map((j) => (
            <li key={j.id} className="border border-[#d9d0c4] rounded-xl p-3 bg-[#fffbf5]">
              <div className="flex justify-between gap-2">
                <a href={j.url} target="_blank" rel="noreferrer" className="font-medium">
                  {j.title}
                </a>
                <strong>{j.score}</strong>
              </div>
              <p className="text-sm text-[#5c6b64]">
                {j.company} · {j.locationText} · {j.workMode} · {j.source}
              </p>
              <p className="text-sm mt-1">
                Match {j.score}/100 · {j.why}
              </p>
              {j.warnings?.length ? <p className="text-xs text-[#9b2c2c]">{j.warnings.join(" · ")}</p> : null}
              <p className="text-xs mt-1">
                First seen {j.firstSeenAt.slice(0, 10)} · Last checked {j.lastCheckedAt.slice(0, 10)}
              </p>
              <Feedback listingId={j.id} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
