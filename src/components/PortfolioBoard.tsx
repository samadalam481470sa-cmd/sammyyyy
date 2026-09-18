import Link from "next/link";
import { MgaTable, SectionIntro, StatusBadge } from "@/components/ui";
import {
  findPipelineSynergyCandidates,
  findSynergies,
  formatUsdMm,
  getAllMetrics,
} from "@/lib/metrics";
import type { SynergyOverlap } from "@/lib/schema";
import { platformData } from "@/lib/data";

const dimensionLabel = {
  lineOfBusiness: "Line of Business",
  coverageType: "Coverage Type",
  geographicRegion: "Geographic Region",
} as const;

export function PortfolioBoard() {
  const acquired = getAllMetrics("acquired");
  const synergies = findSynergies("acquired");
  const pipelineCandidates = findPipelineSynergyCandidates();
  const totalEbitda = acquired.reduce(
    (sum, m) => sum + (m.latestEbitda ?? 0),
    0,
  );
  const acquiredIds = new Set(
    platformData.mgas.filter((m) => m.status === "acquired").map((m) => m.id),
  );

  return (
    <div>
      <SectionIntro
        eyebrow="Executive Board · PE Advisors"
        title="One Platform — Aggregated Portfolio"
        description="Master view of acquired MGAs. Overlaps in lines of business, coverages, and regions surface synergy and growth potential across the roll-up."
      />

      <div className="animate-rise mb-8 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Acquired MGAs"
          value={String(acquired.length)}
          hint="Currently on-platform"
        />
        <Stat
          label="Portfolio EBITDA"
          value={formatUsdMm(totalEbitda)}
          hint="Sum of latest year"
        />
        <Stat
          label="Synergy signals"
          value={String(synergies.length + pipelineCandidates.length)}
          hint="On-platform overlaps + pipeline candidates"
        />
      </div>

      <h3 className="font-display mb-3 text-xl font-semibold text-ink">
        Acquired entities
      </h3>
      <MgaTable rows={acquired} />

      <h3 className="font-display mb-3 mt-10 text-xl font-semibold text-ink">
        On-platform synergy map
      </h3>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Where two or more on-platform MGAs share a line, coverage, or region —
        candidates for cross-sell, capacity sharing, or wholesale channel
        leverage.
      </p>

      <SynergyGrid items={synergies} empty="No multi-MGA overlaps in the current acquired set." />

      <h3 className="font-display mb-3 mt-10 text-xl font-semibold text-ink">
        Pipeline synergy candidates
      </h3>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Prospect MGAs that already overlap an on-platform line, coverage, or
        region — e.g. Atlantic Binding vs. Harborpoint on Northeast Casualty.
      </p>

      <SynergyGrid
        items={pipelineCandidates}
        empty="No pipeline overlaps with the current platform."
        highlightPipelineIds={acquiredIds}
      />

      <div className="mt-8 rounded-lg border border-dashed border-line bg-fog/50 p-4 text-sm text-muted">
        <StatusBadge status="pipeline" />{" "}
        <span className="ml-2">
          Bronze = pipeline prospect · Teal badge count includes both platform
          and prospect MGAs in that overlap.
        </span>
      </div>
    </div>
  );
}

function SynergyGrid({
  items,
  empty,
  highlightPipelineIds,
}: {
  items: SynergyOverlap[];
  empty: string;
  highlightPipelineIds?: Set<string>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((s, i) => (
        <article
          key={`${s.dimension}-${s.value}-${s.mgaIds.join("-")}`}
          className="animate-rise rounded-lg border border-line/80 bg-paper/80 p-4"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-bronze">
              {dimensionLabel[s.dimension]}
            </span>
            <span className="rounded bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal-deep">
              {s.mgaIds.length} MGAs
            </span>
          </div>
          <h4 className="font-display text-lg font-semibold text-ink">
            {s.value}
          </h4>
          <ul className="mt-3 space-y-1.5">
            {s.mgaIds.map((id, idx) => {
              const isPlatform = highlightPipelineIds?.has(id);
              return (
                <li key={id} className="flex items-center gap-2">
                  <Link
                    href={`/mgas/${id}`}
                    className="text-sm font-medium text-teal hover:underline"
                  >
                    {s.mgaNames[idx]}
                  </Link>
                  {highlightPipelineIds && (
                    <StatusBadge status={isPlatform ? "acquired" : "pipeline"} />
                  )}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line/80 bg-ink px-4 py-4 text-paper">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper/60">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-paper/55">{hint}</p>
    </div>
  );
}
