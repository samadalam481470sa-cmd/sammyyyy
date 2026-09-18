import Link from "next/link";
import type { MgaMetrics } from "@/lib/schema";
import { formatPct, formatUsdMm } from "@/lib/metrics";

export function StatusBadge({ status }: { status: "pipeline" | "acquired" }) {
  const isAcquired = status === "acquired";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isAcquired
          ? "bg-teal/15 text-teal-deep"
          : "bg-bronze/15 text-bronze"
      }`}
    >
      {isAcquired ? "On-Platform" : "Pipeline"}
    </span>
  );
}

export function GrowthCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "font-semibold text-good" : "font-semibold text-signal"}>
      {formatPct(value)}
    </span>
  );
}

export function EbitdaSpark({
  values,
}: {
  values: { year: number; ebitda: number }[];
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values.map((v) => v.ebitda));
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden>
      {values.map((v, i) => (
        <div key={v.year} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="animate-bar w-full rounded-sm bg-teal/80"
            style={{
              height: `${Math.max(12, (v.ebitda / max) * 100)}%`,
              animationDelay: `${i * 80}ms`,
            }}
            title={`${v.year}: $${v.ebitda}M`}
          />
        </div>
      ))}
    </div>
  );
}

export function MgaTable({
  rows,
  showStatus = false,
}: {
  rows: MgaMetrics[];
  showStatus?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line/80 bg-paper/70 shadow-[0_1px_0_rgba(12,31,51,0.04)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-fog/90 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">MGA</th>
            {showStatus && <th className="px-4 py-3 font-semibold">Status</th>}
            <th className="px-4 py-3 font-semibold">Experience</th>
            <th className="px-4 py-3 font-semibold">Region</th>
            <th className="px-4 py-3 font-semibold">Latest EBITDA</th>
            <th className="px-4 py-3 font-semibold">YoY Growth</th>
            <th className="px-4 py-3 font-semibold">Lines</th>
            <th className="px-4 py-3 font-semibold">Retail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.mga.id}
              className="animate-fade-slide border-b border-line/60 last:border-0 hover:bg-fog/50"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/mgas/${row.mga.id}`}
                  className="font-semibold text-ink hover:text-teal"
                >
                  {row.mga.name}
                </Link>
                <div className="text-xs text-muted">{row.mga.headquarters}</div>
              </td>
              {showStatus && (
                <td className="px-4 py-3">
                  <StatusBadge status={row.mga.status} />
                </td>
              )}
              <td className="px-4 py-3 tabular-nums">
                {row.mga.yearsOfExperience} yrs
                {row.mga.yearsOfExperience >= 20 && (
                  <span className="ml-1 text-[10px] font-semibold uppercase text-teal">
                    20+
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{row.mga.primaryRegion}</td>
              <td className="px-4 py-3 tabular-nums">
                {formatUsdMm(row.latestEbitda)}
              </td>
              <td className="px-4 py-3">
                <GrowthCell value={row.yoyEbitdaGrowth} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-soft">
                {row.linesOfBusiness.join(", ") || "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">{row.retailCount}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={showStatus ? 8 : 7}
                className="px-4 py-10 text-center text-muted"
              >
                No MGAs match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="animate-rise mb-8 max-w-3xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-bronze">
        {eyebrow}
      </p>
      <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted sm:text-base">{description}</p>
    </div>
  );
}
