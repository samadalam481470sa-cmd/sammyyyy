"use client";

import { useMemo, useState } from "react";
import { MgaTable, SectionIntro } from "@/components/ui";
import { getAllMetrics, REGIONS } from "@/lib/metrics";
import type { MgaMetrics } from "@/lib/schema";

type SortKey = "growth" | "experience" | "ebitda" | "name";

export function PipelineBoard() {
  const base = useMemo(() => getAllMetrics("pipeline"), []);
  const [minExperience, setMinExperience] = useState(20);
  const [region, setRegion] = useState<string>("all");
  const [minGrowth, setMinGrowth] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("growth");

  const filtered = useMemo(() => {
    let rows = base.filter((m) => m.mga.yearsOfExperience >= minExperience);
    if (region !== "all") {
      rows = rows.filter((m) => m.mga.primaryRegion === region);
    }
    if (minGrowth > 0) {
      rows = rows.filter(
        (m) => m.yoyEbitdaGrowth !== null && m.yoyEbitdaGrowth >= minGrowth,
      );
    }
    return sortRows(rows, sortKey);
  }, [base, minExperience, region, minGrowth, sortKey]);

  return (
    <div>
      <SectionIntro
        eyebrow="Corporate Development"
        title="M&A Pipeline"
        description="Track target MGAs in market. Filter for Best-in-Class: 20+ years experience, highest EBITDA growth, and geographic focus."
      />

      <div className="animate-rise mb-6 grid gap-3 rounded-lg border border-line/80 bg-paper/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Min. experience (yrs)
          <select
            className="rounded border border-line bg-fog px-2.5 py-2 text-sm font-medium text-ink"
            value={minExperience}
            onChange={(e) => setMinExperience(Number(e.target.value))}
          >
            <option value={0}>Any</option>
            <option value={15}>15+</option>
            <option value={20}>20+ (target)</option>
            <option value={25}>25+</option>
            <option value={30}>30+</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Geographic region
          <select
            className="rounded border border-line bg-fog px-2.5 py-2 text-sm font-medium text-ink"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Min. YoY EBITDA growth
          <select
            className="rounded border border-line bg-fog px-2.5 py-2 text-sm font-medium text-ink"
            value={minGrowth}
            onChange={(e) => setMinGrowth(Number(e.target.value))}
          >
            <option value={0}>Any</option>
            <option value={0.1}>10%+</option>
            <option value={0.15}>15%+</option>
            <option value={0.2}>20%+</option>
            <option value={0.25}>25%+</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Sort by
          <select
            className="rounded border border-line bg-fog px-2.5 py-2 text-sm font-medium text-ink"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="growth">Highest EBITDA growth</option>
            <option value="experience">Years of experience</option>
            <option value="ebitda">Latest EBITDA</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <p className="mb-3 text-sm text-muted">
        Showing <span className="font-semibold text-ink">{filtered.length}</span>{" "}
        of {base.length} pipeline targets
      </p>

      <MgaTable rows={filtered} />
    </div>
  );
}

function sortRows(rows: MgaMetrics[], key: SortKey): MgaMetrics[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (key) {
      case "growth":
        return (b.yoyEbitdaGrowth ?? -1) - (a.yoyEbitdaGrowth ?? -1);
      case "experience":
        return b.mga.yearsOfExperience - a.mga.yearsOfExperience;
      case "ebitda":
        return (b.latestEbitda ?? 0) - (a.latestEbitda ?? 0);
      case "name":
        return a.mga.name.localeCompare(b.mga.name);
      default:
        return 0;
    }
  });
  return copy;
}
