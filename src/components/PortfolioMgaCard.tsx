import Link from "next/link";
import type { MgaListItem } from "@/types/mga";
import { formatPct, formatUsd } from "@/lib/metrics";
import { PillTag } from "@/components/StatusBadge";

export default function PortfolioMgaCard({ mga }: { mga: MgaListItem }) {
  return (
    <Link
      href={`/mga/${mga.id}`}
      className="card block p-4 transition-shadow hover:shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{mga.name}</p>
          <p className="text-xs text-slate-500">
            {mga.headquartersState} &middot; {mga.yearsOfExperience} yrs experience
          </p>
        </div>
        <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-accent-600">
          On-Platform
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Latest EBITDA
          </p>
          <p className="text-base font-semibold text-slate-900">{formatUsd(mga.latestEbitdaUsd)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            YoY Growth
          </p>
          <p className="text-base font-semibold text-accent-600">
            {formatPct(mga.ebitdaYoyGrowthPct)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {mga.linesOfBusiness.map((lob) => (
          <PillTag key={lob} tone="brand">
            {lob}
          </PillTag>
        ))}
        {mga.regions.map((r) => (
          <PillTag key={r}>{r}</PillTag>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {mga.retailAgencies.length} retail agenc{mga.retailAgencies.length === 1 ? "y" : "ies"}{" "}
        managed
      </p>
    </Link>
  );
}
