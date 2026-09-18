import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { withDerivedMetrics, formatUsd, formatPct } from "@/lib/metrics";
import { findAllSynergies } from "@/lib/synergies";
import StatCard from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const allMgas = await prisma.mga.findMany({
    include: { financials: true, insurancePrograms: true, retailAgencies: true },
    orderBy: { name: "asc" },
  });

  const enriched = allMgas.map(withDerivedMetrics);
  const pipeline = enriched.filter((m) => m.status === "PIPELINE");
  const acquired = enriched.filter((m) => m.status === "ACQUIRED");

  const portfolioEbitda = acquired.reduce((sum, m) => sum + (m.latestEbitdaUsd ?? 0), 0);
  const avgYearsExperience =
    enriched.length > 0
      ? enriched.reduce((sum, m) => sum + m.yearsOfExperience, 0) / enriched.length
      : 0;
  const totalRetailAgencies = enriched.reduce((sum, m) => sum + m.retailAgencies.length, 0);

  const synergies = findAllSynergies(acquired);
  const topSynergies = [
    ...synergies.lineOfBusiness,
    ...synergies.coverageType,
    ...synergies.geographicRegion,
  ]
    .sort((a, b) => b.mgaIds.length - a.mgaIds.length)
    .slice(0, 4);

  const topPipelineByGrowth = [...pipeline]
    .filter((m) => m.ebitdaYoyGrowthPct !== null)
    .sort((a, b) => (b.ebitdaYoyGrowthPct ?? 0) - (a.ebitdaYoyGrowthPct ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Roll-Up Strategy Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          MGA CRM &amp; Portfolio Wireframe
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          A first pass at the minimum viable schema and dashboards for tracking MGA acquisition
          targets and visualizing synergies across the acquired portfolio. Built to confirm the
          tracked metrics — EBITDA, Line of Business, Region, Years of Experience — are exactly
          what should be on screen.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pipeline Targets" value={String(pipeline.length)} hint="Tracked prospects" />
        <StatCard
          label="On-Platform MGAs"
          value={String(acquired.length)}
          hint="Acquired &amp; consolidated"
          tone="positive"
        />
        <StatCard
          label="Portfolio EBITDA"
          value={formatUsd(portfolioEbitda)}
          hint="Sum of latest year, acquired MGAs"
          tone="brand"
        />
        <StatCard
          label="Avg. Years Experience"
          value={avgYearsExperience.toFixed(0)}
          hint={`${totalRetailAgencies} retail agencies tracked`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Top Synergies On-Platform</h2>
            <Link href="/portfolio" className="text-xs font-medium text-brand-600 hover:underline">
              View full portfolio &rarr;
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Attributes shared by 2+ acquired MGAs — the overlap the exec team and PE advisors care
            about.
          </p>
          <ul className="mt-4 space-y-2.5">
            {topSynergies.length === 0 && (
              <li className="text-sm text-slate-400">No overlaps detected yet.</li>
            )}
            {topSynergies.map((s) => (
              <li
                key={`${s.dimension}-${s.value}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.mgaNames.join(", ")}</p>
                </div>
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {s.mgaIds.length} MGAs
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Fastest-Growing Pipeline Targets</h2>
            <Link href="/pipeline" className="text-xs font-medium text-brand-600 hover:underline">
              View full pipeline &rarr;
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">Ranked by most recent year-over-year EBITDA growth.</p>
          <ul className="mt-4 space-y-2.5">
            {topPipelineByGrowth.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div>
                  <Link href={`/mga/${m.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                    {m.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {m.yearsOfExperience} yrs experience &middot; {m.regions.join(", ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-accent-600">
                    {formatPct(m.ebitdaYoyGrowthPct)}
                  </p>
                  <StatusBadge status={m.status} pipelineStage={m.pipelineStage} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Confirm With Mary Tonight</h2>
        <p className="mt-1 text-xs text-slate-500">
          Talking points for the 7:00 PM call on whether this schema captures what should be on
          screen.
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            Is <span className="font-medium">Historical EBITDA</span> the right growth metric, or
            should Revenue / Loss Ratio be shown alongside it?
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            Should <span className="font-medium">Line of Business</span> and{" "}
            <span className="font-medium">Region</span> be tracked at the MGA level too, not just
            per-program?
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            Does <span className="font-medium">20+ years experience</span> need its own
            &ldquo;Best in Class&rdquo; filter preset on the pipeline view?
          </li>
        </ul>
      </section>
    </div>
  );
}
