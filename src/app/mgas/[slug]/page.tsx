import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EbitdaTrendChart } from "@/components/charts";
import { BestInClassBadge, StageBadge, StatusBadge } from "@/components/status-badges";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  StatTile,
  TagChip,
  Td,
  Th,
} from "@/components/ui";
import {
  formatDate,
  formatMultiple,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatUsd,
  formatUsdCompact,
} from "@/lib/format";
import { getMgaBySlug } from "@/lib/queries";
import { BEST_IN_CLASS_THRESHOLDS, MGA_STATUS } from "@/lib/taxonomy";

// CRM records change constantly, so every MGA page is rendered on demand
// rather than prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mga = await getMgaBySlug(slug);
  return { title: mga?.name ?? "MGA not found" };
}

export default async function MgaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mga = await getMgaBySlug(slug);

  if (!mga) notFound();

  const onPlatform = mga.status === MGA_STATUS.ON_PLATFORM;
  const activePrograms = mga.programs.filter((program) => program.isActive);
  const totalProgramPremium = activePrograms.reduce(
    (sum, program) => sum + program.writtenPremiumUsd,
    0,
  );
  const retailPremium = mga.retailAgencies.reduce(
    (sum, agency) => sum + (agency.annualPremiumPlacedUsd ?? 0),
    0,
  );
  const weightedLossRatio =
    totalProgramPremium > 0
      ? activePrograms.reduce(
          (sum, program) =>
            sum + (program.lossRatio ?? 0) * program.writtenPremiumUsd,
          0,
        ) / totalProgramPremium
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={onPlatform ? "Platform company" : "Pipeline target"}
        title={mga.name}
        description={
          <>
            {mga.principalName} · {mga.headquartersCity},{" "}
            {mga.headquartersState} · founded {mga.foundedYear} ·{" "}
            {mga.yearsOfExperience} years underwriting
            {mga.website && (
              <>
                {" · "}
                <span className="font-mono text-xs text-slate-500">
                  {mga.website}
                </span>
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusBadge status={mga.status} />
            <StageBadge stage={mga.stage} />
            <BestInClassBadge result={mga.bestInClass} />
            <Link
              href={onPlatform ? "/portfolio" : "/pipeline"}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              Back to {onPlatform ? "portfolio" : "pipeline"}
            </Link>
          </div>
        }
      />

      {mga.notes && (
        <div className="rounded-xl border-l-4 border-navy-500 bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
            Deal note{mga.dealLead ? ` · ${mga.dealLead}` : ""}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            {mga.notes}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="brand"
          label={`EBITDA · FY${mga.trend.latestYear ?? "—"}`}
          value={formatUsdCompact(mga.trend.latestEbitdaUsd)}
          delta={mga.trend.latestYoyGrowth}
          sublabel="vs prior year"
        />
        <StatTile
          label={`EBITDA CAGR · FY${mga.trend.firstYear ?? "—"}–${mga.trend.latestYear ?? "—"}`}
          value={formatSignedPercent(mga.trend.ebitdaCagr)}
          sublabel={`thesis is ${formatPercent(BEST_IN_CLASS_THRESHOLDS.minEbitdaCagr, 0)}+`}
        />
        <StatTile
          label="Gross written premium"
          value={formatUsdCompact(totalProgramPremium)}
          sublabel={`${activePrograms.length} active programs`}
        />
        <StatTile
          label={onPlatform ? "Entry multiple" : "Ask multiple"}
          value={formatMultiple(mga.ebitdaMultiple)}
          sublabel={
            onPlatform
              ? `${formatUsdCompact(mga.enterpriseValueUsd)} EV · ${mga.ownershipPercent ?? "—"}% owned`
              : "indicative, pre-diligence"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="EBITDA history"
          description="Earnings before interest, bad debt and taxes, as defined for this platform. Bars are the dollars, the gold line is year-over-year growth. Lighter bars are management projections."
        >
          <EbitdaTrendChart data={mga.trend.series} />
        </Panel>

        <Panel
          title="Thesis fit"
          description="The three criteria Newport screens on, and where this MGA lands against each."
        >
          <div className="space-y-3">
            <CriterionRow
              label="Years of experience"
              met={mga.bestInClass.meetsExperience}
              actual={`${mga.yearsOfExperience} yrs`}
              target={`${BEST_IN_CLASS_THRESHOLDS.minYearsOfExperience}+ yrs`}
            />
            <CriterionRow
              label="EBITDA CAGR"
              met={mga.bestInClass.meetsGrowth}
              actual={formatSignedPercent(mga.trend.ebitdaCagr)}
              target={`${formatPercent(BEST_IN_CLASS_THRESHOLDS.minEbitdaCagr, 0)}+`}
            />
            <CriterionRow
              label="Trailing EBITDA"
              met={mga.bestInClass.meetsScale}
              actual={formatUsdCompact(mga.trend.latestEbitdaUsd)}
              target={`${formatUsdCompact(BEST_IN_CLASS_THRESHOLDS.minLatestEbitdaUsd)}+`}
            />
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-600">
                Composite score
              </span>
              <span className="text-xl font-semibold tabular text-navy-800">
                {formatNumber(mga.bestInClass.score)}
                <span className="text-xs font-normal text-slate-400"> /100</span>
              </span>
            </div>
            {onPlatform && (
              <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                <p className="font-medium text-slate-600">Acquired</p>
                <p className="mt-0.5">{formatDate(mga.acquisitionDate)}</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Financial history"
        description="The source rows behind every derived figure on this page. Audited and projected years are labelled so a forecast is never read as an actual."
        bodyClassName="p-0"
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th>Fiscal year</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">EBITDA</Th>
                <Th align="right">Margin</Th>
                <Th align="right">YoY growth</Th>
                <Th align="right">Bad debt add-back</Th>
                <Th align="right">Written premium</Th>
                <Th>Basis</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mga.trend.series.map((point) => {
                const period = mga.financials.find(
                  (row) => row.fiscalYear === point.fiscalYear,
                );
                return (
                  <tr
                    key={point.fiscalYear}
                    className={point.isProjected ? "bg-navy-50/40" : undefined}
                  >
                    <Td className="font-medium text-slate-900">
                      FY{point.fiscalYear}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatUsd(point.revenueUsd)}
                    </Td>
                    <Td align="right" className="font-semibold tabular">
                      {formatUsd(point.ebitdaUsd)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatPercent(point.ebitdaMargin)}
                    </Td>
                    <Td align="right" className="tabular">
                      {point.yoyGrowth === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={
                            point.yoyGrowth >= 0
                              ? "font-medium text-emerald-700"
                              : "font-medium text-rose-600"
                          }
                        >
                          {formatSignedPercent(point.yoyGrowth)}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="tabular text-slate-500">
                      {formatUsd(period?.badDebtAddbackUsd)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatUsd(point.writtenPremiumUsd)}
                    </Td>
                    <Td>
                      {point.isProjected ? (
                        <Badge tone="navy">Projected</Badge>
                      ) : point.isAudited ? (
                        <Badge tone="emerald">Audited</Badge>
                      ) : (
                        <Badge tone="outline">Unaudited actual</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={`Insurance programs (${activePrograms.length})`}
        description={
          onPlatform
            ? "Gold tags are also carried by another acquired MGA — those are the overlaps the synergy analysis picks up. Plain tags sit only in this MGA."
            : "Tags are matched against the acquired portfolio once a deal closes; today they describe what this target would bring to the platform."
        }
        bodyClassName="p-0"
      >
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th>Program</Th>
                <Th>Line of business</Th>
                <Th>Coverage type</Th>
                <Th>Region</Th>
                <Th>Carrier</Th>
                <Th align="right">Written premium</Th>
                <Th align="right">Loss ratio</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mga.programs.map((program) => (
                <tr key={program.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">
                    {program.name}
                    {!program.isActive && (
                      <Badge tone="rose" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <TagChip
                      label={program.lineOfBusiness}
                      shared={mga.sharedTags.linesOfBusiness.includes(
                        program.lineOfBusiness,
                      )}
                    />
                  </Td>
                  <Td>
                    <TagChip
                      label={program.coverageType}
                      shared={mga.sharedTags.coverageTypes.includes(
                        program.coverageType,
                      )}
                    />
                  </Td>
                  <Td>
                    <TagChip
                      label={program.geographicRegion}
                      shared={mga.sharedTags.geographicRegions.includes(
                        program.geographicRegion,
                      )}
                    />
                  </Td>
                  <Td className="text-slate-600">
                    {program.carrierPartner ?? "—"}
                  </Td>
                  <Td align="right" className="font-medium tabular">
                    {formatUsdCompact(program.writtenPremiumUsd)}
                  </Td>
                  <Td align="right" className="tabular">
                    {formatPercent(program.lossRatio, 0)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <Td colSpan={5} className="font-semibold text-slate-700">
                  Total
                </Td>
                <Td align="right" className="font-semibold tabular">
                  {formatUsdCompact(totalProgramPremium)}
                </Td>
                <Td align="right" className="font-semibold tabular">
                  {formatPercent(weightedLossRatio, 0)}
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel
        title={`Retail agencies (${mga.retailAgencies.length})`}
        description={`The independent retailers placing business through ${mga.name}. They are unrelated to each other and to Newport — ${formatUsdCompact(retailPremium)} of the ${formatUsdCompact(totalProgramPremium)} written premium is placed by the retailers named here.`}
        bodyClassName="p-0"
      >
        {mga.retailAgencies.length === 0 ? (
          <div className="p-5">
            <EmptyState>No retail agencies recorded for this MGA.</EmptyState>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Agency</Th>
                  <Th>Principal</Th>
                  <Th>Location</Th>
                  <Th>Region</Th>
                  <Th align="right">Appointed</Th>
                  <Th align="right">Premium placed</Th>
                  <Th align="right">Policies</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mga.retailAgencies.map((agency) => (
                  <tr key={agency.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">{agency.name}</Td>
                    <Td className="text-slate-600">{agency.principalName}</Td>
                    <Td className="text-slate-600">
                      {agency.city}, {agency.state}
                    </Td>
                    <Td>
                      <Badge tone="slate">{agency.region}</Badge>
                    </Td>
                    <Td align="right" className="tabular text-slate-600">
                      {formatDate(agency.appointedOn)}
                    </Td>
                    <Td align="right" className="font-medium tabular">
                      {formatUsdCompact(agency.annualPremiumPlacedUsd)}
                    </Td>
                    <Td align="right" className="tabular text-slate-600">
                      {formatNumber(agency.policyCount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CriterionRow({
  label,
  met,
  actual,
  target,
}: {
  label: string;
  met: boolean;
  actual: string;
  target: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400">Target {target}</p>
      </div>
      <div className="text-right">
        <p
          className={
            met
              ? "text-sm font-semibold tabular text-emerald-700"
              : "text-sm font-semibold tabular text-rose-600"
          }
        >
          {actual}
        </p>
        <p className="text-[11px] font-medium text-slate-400">
          {met ? "Clears" : "Misses"}
        </p>
      </div>
    </div>
  );
}
