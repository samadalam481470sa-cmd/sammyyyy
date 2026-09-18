import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EbitdaSpark,
  GrowthCell,
  SectionIntro,
  StatusBadge,
} from "@/components/ui";
import { platformData } from "@/lib/data";
import {
  formatPct,
  formatUsdMm,
  getFinancialsForMga,
  getMgaById,
  getMgaMetrics,
} from "@/lib/metrics";

export function generateStaticParams() {
  return platformData.mgas.map((m) => ({ id: m.id }));
}

export default async function MgaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mga = getMgaById(id);
  if (!mga) notFound();

  const metrics = getMgaMetrics(mga);
  const financials = getFinancialsForMga(mga.id);
  const agencies = platformData.retailAgencies.filter(
    (r) => r.associatedMgaId === mga.id,
  );

  return (
    <div>
      <Link
        href={mga.status === "acquired" ? "/portfolio" : "/pipeline"}
        className="mb-4 inline-block text-sm font-medium text-teal hover:underline"
      >
        ← Back to {mga.status === "acquired" ? "portfolio" : "pipeline"}
      </Link>

      <SectionIntro
        eyebrow="MGA Account"
        title={mga.name}
        description={mga.notes ?? "Managing General Agent profile."}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={mga.status} />
        <span className="text-sm text-muted">{mga.headquarters}</span>
        <span className="text-sm text-muted">·</span>
        <span className="text-sm text-muted">{mga.primaryRegion}</span>
        <span className="text-sm text-muted">·</span>
        <span className="text-sm font-semibold text-ink">
          {mga.yearsOfExperience} years experience
        </span>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <MetricTile
          label="Latest EBITDA"
          value={formatUsdMm(metrics.latestEbitda)}
        />
        <MetricTile
          label="YoY EBITDA Growth"
          value={formatPct(metrics.yoyEbitdaGrowth)}
          accent={
            metrics.yoyEbitdaGrowth !== null && metrics.yoyEbitdaGrowth > 0
          }
        />
        <MetricTile
          label="Retail Agencies (Jakes)"
          value={String(metrics.retailCount)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line/80 bg-paper/80 p-5">
          <h3 className="font-display mb-3 text-lg font-semibold text-ink">
            Historical EBITDA
          </h3>
          <div className="mb-4 h-24">
            <EbitdaSpark values={financials} />
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 text-left font-semibold">Year</th>
                <th className="pb-2 text-right font-semibold">EBITDA</th>
                <th className="pb-2 text-right font-semibold">YoY</th>
              </tr>
            </thead>
            <tbody>
              {financials.map((f, i) => {
                const prior = i > 0 ? financials[i - 1].ebitda : null;
                const growth =
                  prior && prior !== 0 ? (f.ebitda - prior) / prior : null;
                return (
                  <tr key={f.id} className="border-t border-line/50">
                    <td className="py-2">{f.year}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatUsdMm(f.ebitda)}
                    </td>
                    <td className="py-2 text-right">
                      <GrowthCell value={growth} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-line/80 bg-paper/80 p-5">
          <h3 className="font-display mb-3 text-lg font-semibold text-ink">
            Insurance Programs
          </h3>
          <ul className="space-y-3">
            {metrics.programs.map((p) => (
              <li
                key={p.id}
                className="border-b border-line/50 pb-3 last:border-0 last:pb-0"
              >
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink-soft">
                    {p.lineOfBusiness}
                  </span>{" "}
                  · {p.coverageType} · {p.geographicRegion}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line/80 bg-paper/80 p-5">
        <h3 className="font-display mb-1 text-lg font-semibold text-ink">
          Retail Agencies — &ldquo;The Jakes&rdquo;
        </h3>
        <p className="mb-4 text-sm text-muted">
          Independent retail entities managed by this MGA (
          <code className="text-xs">Associated_MGA</code> FK).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 font-semibold">Agency</th>
                <th className="pb-2 font-semibold">Location</th>
                <th className="pb-2 font-semibold">Premium Vol.</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.id} className="border-b border-line/50 last:border-0">
                  <td className="py-2.5 font-medium">{a.name}</td>
                  <td className="py-2.5 text-muted">
                    {a.city}, {a.state}
                  </td>
                  <td className="py-2.5 tabular-nums">
                    {a.premiumVolumeMm != null
                      ? formatUsdMm(a.premiumVolumeMm)
                      : "—"}
                  </td>
                </tr>
              ))}
              {agencies.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted">
                    No retail agencies linked yet.
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

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line/80 bg-fog/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`font-display mt-1 text-2xl font-semibold ${
          accent ? "text-good" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
