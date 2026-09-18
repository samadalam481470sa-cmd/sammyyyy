"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { MgaListItem } from "@/types/mga";
import { dimensionLabel, type SynergyDimension } from "@/lib/synergies";

const DIMENSIONS: SynergyDimension[] = ["lineOfBusiness", "coverageType", "geographicRegion"];

const DIMENSION_TO_FIELD: Record<SynergyDimension, keyof MgaListItem> = {
  lineOfBusiness: "linesOfBusiness",
  coverageType: "coverageTypes",
  geographicRegion: "regions",
};

export default function SynergyMatrix({ mgas }: { mgas: MgaListItem[] }) {
  const [dimension, setDimension] = useState<SynergyDimension>("lineOfBusiness");

  const field = DIMENSION_TO_FIELD[dimension];

  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const mga of mgas) {
      for (const value of mga[field] as string[]) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [mgas, field]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Portfolio Synergy Matrix</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rows are acquired MGAs, columns are {dimensionLabel(dimension).toLowerCase()} values.
            Highlighted columns are shared by 2+ MGAs.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {DIMENSIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDimension(d)}
              className={clsx(
                "btn-tab",
                dimension === d ? "btn-tab-active" : "btn-tab-inactive",
              )}
            >
              {dimensionLabel(d)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                MGA
              </th>
              {columns.map((col) => (
                <th
                  key={col.value}
                  className={clsx(
                    "min-w-[110px] border-b border-slate-100 px-2 py-2 text-center text-[11px] font-semibold",
                    col.count > 1 ? "bg-brand-50 text-brand-700" : "text-slate-400",
                  )}
                  title={`${col.count} MGA${col.count > 1 ? "s" : ""} overlap`}
                >
                  {col.value}
                  {col.count > 1 && (
                    <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {col.count}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mgas.map((mga) => {
              const values = new Set(mga[field] as string[]);
              return (
                <tr key={mga.id} className="border-b border-slate-50">
                  <td className="sticky left-0 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                    {mga.name}
                  </td>
                  {columns.map((col) => {
                    const has = values.has(col.value);
                    return (
                      <td
                        key={col.value}
                        className={clsx(
                          "px-2 py-2 text-center",
                          has && col.count > 1 && "bg-accent-500/15",
                          has && col.count <= 1 && "bg-slate-50",
                        )}
                      >
                        {has ? (
                          <span
                            className={clsx(
                              "mx-auto flex h-2.5 w-2.5 rounded-full",
                              col.count > 1 ? "bg-accent-500" : "bg-slate-300",
                            )}
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {mgas.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400">No acquired MGAs on-platform yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
