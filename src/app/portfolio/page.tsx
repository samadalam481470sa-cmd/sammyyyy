import { prisma } from "@/lib/prisma";
import { withDerivedMetrics, formatUsd } from "@/lib/metrics";
import { findAllSynergies } from "@/lib/synergies";
import StatCard from "@/components/StatCard";
import SynergyMatrix from "@/components/SynergyMatrix";
import SynergyList from "@/components/SynergyList";
import PortfolioMgaCard from "@/components/PortfolioMgaCard";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const acquiredRaw = await prisma.mga.findMany({
    where: { status: "ACQUIRED" },
    include: { financials: true, insurancePrograms: true, retailAgencies: true },
    orderBy: { name: "asc" },
  });

  const acquired = acquiredRaw.map(withDerivedMetrics);
  const synergies = findAllSynergies(acquired);

  const portfolioEbitda = acquired.reduce((sum, m) => sum + (m.latestEbitdaUsd ?? 0), 0);
  const totalPrograms = acquired.reduce((sum, m) => sum + m.insurancePrograms.length, 0);
  const totalAgencies = acquired.reduce((sum, m) => sum + m.retailAgencies.length, 0);
  const overlapCount =
    synergies.lineOfBusiness.length + synergies.coverageType.length + synergies.geographicRegion.length;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          The &ldquo;One Platform&rdquo;
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Aggregated Portfolio View
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Master view of all currently acquired MGAs, highlighting overlapping lines of business,
          coverages, and regions so the executive board and PE advisors can spot synergies and
          growth potential.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="On-Platform MGAs" value={String(acquired.length)} tone="positive" />
        <StatCard label="Portfolio EBITDA" value={formatUsd(portfolioEbitda)} tone="brand" />
        <StatCard label="Active Programs" value={String(totalPrograms)} />
        <StatCard label="Overlapping Attributes" value={String(overlapCount)} hint="Detected synergies" />
      </section>

      <SynergyMatrix mgas={acquired} />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Line of Business Overlap</h3>
          <div className="mt-3">
            <SynergyList groups={synergies.lineOfBusiness} />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Coverage Type Overlap</h3>
          <div className="mt-3">
            <SynergyList groups={synergies.coverageType} />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Geographic Region Overlap</h3>
          <div className="mt-3">
            <SynergyList groups={synergies.geographicRegion} />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">On-Platform MGAs</h2>
          <p className="text-xs text-slate-400">
            {totalAgencies} retail agencies (&ldquo;The Jakes&rdquo;) across the portfolio
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {acquired.map((mga) => (
            <PortfolioMgaCard key={mga.id} mga={mga} />
          ))}
        </div>
        {acquired.length === 0 && (
          <p className="card p-6 text-center text-sm text-slate-400">
            No acquired MGAs yet — close a deal from the pipeline to populate this view.
          </p>
        )}
      </section>
    </div>
  );
}
