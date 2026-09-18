import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { withDerivedMetrics, formatPct, formatUsd, sortByYear } from "@/lib/metrics";
import { StatusBadge, PillTag } from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import EbitdaChart from "@/components/EbitdaChart";

export const dynamic = "force-dynamic";

export default async function MgaDetailPage({ params }: { params: { id: string } }) {
  const mga = await prisma.mga.findUnique({
    where: { id: params.id },
    include: { financials: true, insurancePrograms: true, retailAgencies: true },
  });

  if (!mga) notFound();

  const enriched = withDerivedMetrics(mga);
  const history = sortByYear(mga.financials);

  return (
    <div className="space-y-6">
      <div>
        <Link href={mga.status === "ACQUIRED" ? "/portfolio" : "/pipeline"} className="text-xs font-medium text-brand-600 hover:underline">
          &larr; Back to {mga.status === "ACQUIRED" ? "Portfolio" : "Pipeline"}
        </Link>
      </div>

      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {mga.name}
            </h1>
            <StatusBadge status={enriched.status} pipelineStage={enriched.pipelineStage} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{mga.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>HQ: {mga.headquartersState ?? "—"}</span>
            {mga.contactName && <span>Contact: {mga.contactName}</span>}
            {mga.contactEmail && <span>{mga.contactEmail}</span>}
            {mga.acquiredDate && (
              <span>Acquired: {new Date(mga.acquiredDate).toLocaleDateString()}</span>
            )}
            {mga.askPriceUsd && <span>Ask Price: {formatUsd(mga.askPriceUsd)}</span>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Years of Experience" value={String(mga.yearsOfExperience)} />
        <StatCard label="Latest EBITDA" value={formatUsd(enriched.latestEbitdaUsd)} tone="brand" />
        <StatCard label="YoY EBITDA Growth" value={formatPct(enriched.ebitdaYoyGrowthPct)} tone="positive" />
        <StatCard label="EBITDA CAGR" value={formatPct(enriched.ebitdaCagrPct)} />
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Historical EBITDA</h2>
        <p className="mt-1 text-xs text-slate-500">
          Earnings before interest, bad debt, and taxes — tracked year over year to prove growth.
        </p>
        <div className="mt-4">
          <EbitdaChart records={mga.financials} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">EBITDA</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">YoY Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((record, idx) => {
                const prior = idx > 0 ? history[idx - 1].ebitdaUsd : null;
                const yoy = prior ? ((record.ebitdaUsd - prior) / Math.abs(prior)) * 100 : null;
                return (
                  <tr key={record.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{record.year}</td>
                    <td className="px-3 py-2">{formatUsd(record.ebitdaUsd, false)}</td>
                    <td className="px-3 py-2 text-slate-500">{formatUsd(record.revenueUsd, false)}</td>
                    <td className={`px-3 py-2 font-medium ${yoy === null ? "text-slate-400" : yoy >= 0 ? "text-accent-600" : "text-red-600"}`}>
                      {formatPct(yoy)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Insurance Programs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Line of business, coverage type, and geographic region tracked per program.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Line of Business</th>
                <th className="px-3 py-2">Coverage Type</th>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Premium Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mga.insurancePrograms.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2">
                    <PillTag tone="brand">{p.lineOfBusiness}</PillTag>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.coverageType}</td>
                  <td className="px-3 py-2">
                    <PillTag>{p.geographicRegion}</PillTag>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{formatUsd(p.premiumVolumeUsd, false)}</td>
                </tr>
              ))}
              {mga.insurancePrograms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                    No programs on file.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Retail Agencies (&ldquo;The Jakes&rdquo;)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Independent retail agencies distributing this MGA&rsquo;s programs.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Agency</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mga.retailAgencies.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-slate-800">{a.name}</td>
                  <td className="px-3 py-2 text-slate-600">{a.state ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{a.contactName ?? "—"}</td>
                </tr>
              ))}
              {mga.retailAgencies.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    No retail agencies on file.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
