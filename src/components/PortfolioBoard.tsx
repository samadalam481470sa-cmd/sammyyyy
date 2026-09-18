import Link from "next/link";
import { MgaTable, SectionIntro, StatusBadge } from "@/components/ui";
import {
  findSynergies,
  formatUsdMm,
  getAllMetrics,
} from "@/lib/metrics";

const dimensionLabel = {
  lineOfBusiness: "Line of Business",
  coverageType: "Coverage Type",
  geographicRegion: "Geographic Region",
} as const;

export function PortfolioBoard() {
  const acquired = getAllMetrics("acquired");
  const synergies = findSynergies("acquired");
  const totalEbitda = acquired.reduce(
    (sum, m) => sum + (m.latestEbitda ?? 0),
    0,
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
          value={String(synergies.length)}
          hint="Overlapping LoB / coverage / region"
        />
      </div>

      <h3 className="font-display mb-3 text-xl font-semibold text-ink">
        Acquired entities
      </h3>
      <MgaTable rows={acquired} />

      <h3 className="font-display mb-3 mt-10 text-xl font-semibold text-ink">
        Synergy map
      </h3>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Where two or more on-platform MGAs share a line, coverage, or region —
        candidates for cross-sell, capacity sharing, or wholesale channel
        leverage.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {synergies.map((s, i) => (
          <article
            key={`${s.dimension}-${s.value}`}
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
              {s.mgaIds.map((id, idx) => (
                <li key={id}>
                  <Link
                    href={`/mgas/${id}`}
                    className="text-sm font-medium text-teal hover:underline"
                  >
                    {s.mgaNames[idx]}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {synergies.length === 0 && (
          <p className="text-sm text-muted">
            No multi-MGA overlaps detected in the current portfolio.
          </p>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-line bg-fog/50 p-4 text-sm text-muted">
        <StatusBadge status="acquired" />{" "}
        <span className="ml-2">
          Pipeline targets with matching LoB/region appear as synergy
          <em> candidates</em> after acquisition — see Atlantic Binding vs.
          Harborpoint (Northeast Casualty).
        </span>
      </div>
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
