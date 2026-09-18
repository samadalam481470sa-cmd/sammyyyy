"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { MgaListItem } from "@/types/mga";
import { formatPct, formatUsd } from "@/lib/metrics";
import { StatusBadge } from "@/components/StatusBadge";

type SortKey =
  | "name"
  | "yearsOfExperience"
  | "latestEbitdaUsd"
  | "ebitdaYoyGrowthPct"
  | "ebitdaCagrPct";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "MGA" },
  { key: "yearsOfExperience", label: "Years Exp." },
  { key: "latestEbitdaUsd", label: "Latest EBITDA" },
  { key: "ebitdaYoyGrowthPct", label: "YoY Growth" },
  { key: "ebitdaCagrPct", label: "CAGR" },
];

export default function PipelineTable({ targets }: { targets: MgaListItem[] }) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<string>("ALL");
  const [minYears, setMinYears] = useState(false);
  const [highGrowthOnly, setHighGrowthOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("ebitdaYoyGrowthPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const regions = useMemo(() => {
    const all = new Set<string>();
    targets.forEach((t) => t.regions.forEach((r) => all.add(r)));
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [targets]);

  const filtered = useMemo(() => {
    let rows = targets;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (region !== "ALL") {
      rows = rows.filter((r) => r.regions.includes(region));
    }
    if (minYears) {
      rows = rows.filter((r) => r.yearsOfExperience >= 20);
    }
    if (highGrowthOnly) {
      rows = rows.filter((r) => (r.ebitdaYoyGrowthPct ?? 0) >= 20);
    }
    return rows;
  }, [targets, search, region, minYears, highGrowthOnly]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = (av as number | null) ?? -Infinity;
      const bn = (bv as number | null) ?? -Infinity;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search MGA name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 sm:w-56"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="ALL">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Best in Class
          </span>
          <button
            type="button"
            onClick={() => setMinYears((v) => !v)}
            className={clsx(
              "btn-tab border",
              minYears
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            20+ Years Experience
          </button>
          <button
            type="button"
            onClick={() => setHighGrowthOnly((v) => !v)}
            className={clsx(
              "btn-tab border",
              highGrowthOnly
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            20%+ EBITDA Growth
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="th-cell" onClick={() => toggleSort(col.key)}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-brand-600">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
              ))}
              <th className="th-cell">Region(s)</th>
              <th className="th-cell">Line of Business</th>
              <th className="th-cell">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.map((mga) => (
              <tr key={mga.id} className="hover:bg-slate-50">
                <td className="td-cell font-medium text-slate-900">
                  <Link href={`/mga/${mga.id}`} className="hover:text-brand-700 hover:underline">
                    {mga.name}
                  </Link>
                  <p className="text-xs font-normal text-slate-400">{mga.headquartersState}</p>
                </td>
                <td className="td-cell">
                  <span
                    className={clsx(
                      "font-medium",
                      mga.yearsOfExperience >= 20 ? "text-accent-600" : "text-slate-700",
                    )}
                  >
                    {mga.yearsOfExperience}
                  </span>
                </td>
                <td className="td-cell">{formatUsd(mga.latestEbitdaUsd)}</td>
                <td className="td-cell">
                  <span
                    className={clsx(
                      "font-medium",
                      (mga.ebitdaYoyGrowthPct ?? 0) >= 0 ? "text-accent-600" : "text-red-600",
                    )}
                  >
                    {formatPct(mga.ebitdaYoyGrowthPct)}
                  </span>
                </td>
                <td className="td-cell text-slate-600">{formatPct(mga.ebitdaCagrPct)}</td>
                <td className="td-cell text-slate-600">{mga.regions.join(", ") || "—"}</td>
                <td className="td-cell text-slate-600">{mga.linesOfBusiness.join(", ") || "—"}</td>
                <td className="td-cell">
                  <StatusBadge status={mga.status} pipelineStage={mga.pipelineStage} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="td-cell text-center text-slate-400">
                  No pipeline targets match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Showing {sorted.length} of {targets.length} pipeline targets.
      </p>
    </div>
  );
}
