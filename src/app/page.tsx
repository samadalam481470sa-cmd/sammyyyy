import Link from "next/link";

import { PlatformEbitdaChart } from "@/components/charts";
import { BestInClassBadge, StageBadge } from "@/components/status-badges";
import {
  Badge,
  DeltaPill,
  MgaLink,
  PageHeader,
  Panel,
  StatTile,
  TagChip,
  Td,
  Th,
} from "@/components/ui";
import {
  formatMultiple,
  formatNumber,
  formatSignedPercent,
  formatUsdCompact,
} from "@/lib/format";
import {
  getPipelineTargets,
  getPlatformSummary,
  getSynergyAnalysis,
} from "@/lib/queries";
import {
  BEST_IN_CLASS_THRESHOLDS,
  SYNERGY_DIMENSIONS,
  SYNERGY_DIMENSION_LABEL,
  type SynergyDimension,
} from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [summary, pipeline, synergy] = await Promise.all([
    getPlatformSummary(),
    getPipelineTargets(),
    getSynergyAnalysis(),
  ]);

  const livePipeline = pipeline.filter((target) => target.stage !== "PASSED");
  const bestInClass = livePipeline.filter(
    (target) => target.bestInClass.isBestInClass,
  );
  const topTargets = livePipeline.slice(0, 5);
  const topOverlaps = (
    [
      SYNERGY_DIMENSIONS.lineOfBusiness,
      SYNERGY_DIMENSIONS.geographicRegion,
      SYNERGY_DIMENSIONS.coverageType,
    ] as SynergyDimension[]
  ).map((dimension) => ({
    dimension,
    groups: synergy.overlapsByDimension[dimension]
      .filter((group) => group.isOverlap)
      .slice(0, 4),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Newport Specialty Partners"
        title="Executive overview"
        description="One screen for the board: what the platform earns today, what is in market, and where the acquired MGAs already overlap. Every figure is derived from the underlying MGA records rather than entered by hand, so it cannot drift from the detail pages."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="brand"
          label={`Platform EBITDA · FY${summary.latestFiscalYear ?? "—"}`}
          value={formatUsdCompact(summary.platformEbitdaUsd)}
          delta={summary.platformEbitdaCagr}
          sublabel="CAGR since FY21"
        />
        <StatTile
          label="MGAs on platform"
          value={formatNumber(summary.onPlatformCount)}
          sublabel={`${formatUsdCompact(summary.investedCapitalUsd)} invested capital`}
        />
        <StatTile
          label="Live pipeline"
          value={formatNumber(summary.pipelineCount)}
          sublabel={`${bestInClass.length} clear the full thesis`}
        />
        <StatTile
          tone="gold"
          label="Retail agencies"
          value={formatNumber(summary.retailAgencyCount)}
          sublabel={`${summary.programCount} programs · ${summary.distinctRegions} regions`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Aggregate platform EBITDA"
          description="Sum of the acquired MGAs' fiscal-year EBITDA. All six report across the full window, so the slope is comparable year to year."
          actions={
            <Link
              href="/portfolio"
              className="text-xs font-semibold text-navy-700 hover:text-navy-500"
            >
              Portfolio detail →
            </Link>
          }
        >
          <PlatformEbitdaChart data={summary.aggregateEbitdaByYear} />
        </Panel>

        <Panel
          title="Acquisition thesis"
          description="The screen the pipeline is measured against."
        >
          <ul className="space-y-3">
            <ThesisRow
              label="Operator tenure"
              value={`${BEST_IN_CLASS_THRESHOLDS.minYearsOfExperience}+ years`}
              detail={`portfolio averages ${summary.weightedAverageYearsOfExperience?.toFixed(0) ?? "—"} yrs, EBITDA weighted`}
            />
            <ThesisRow
              label="EBITDA growth"
              value={`${(BEST_IN_CLASS_THRESHOLDS.minEbitdaCagr * 100).toFixed(0)}%+ CAGR`}
              detail={`platform is running at ${formatSignedPercent(summary.platformEbitdaCagr)}`}
            />
            <ThesisRow
              label="Scale"
              value={`${formatUsdCompact(BEST_IN_CLASS_THRESHOLDS.minLatestEbitdaUsd)}+ trailing EBITDA`}
              detail={`${bestInClass.length} of ${livePipeline.length} live targets clear all three`}
            />
          </ul>
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            Pipeline growth is computed from actuals only by default. Management
            projections are available behind a toggle on the pipeline screen and
            are never included in a target&apos;s rank unless switched on.
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Top pipeline targets"
          description="Ranked by composite thesis fit, projections excluded."
          actions={
            <Link
              href="/pipeline"
              className="text-xs font-semibold text-navy-700 hover:text-navy-500"
            >
              Full pipeline →
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Target</Th>
                  <Th>Stage</Th>
                  <Th align="right">Yrs</Th>
                  <Th align="right">CAGR</Th>
                  <Th align="right">EBITDA</Th>
                  <Th align="right">Ask</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topTargets.map((target) => (
                  <tr key={target.id} className="hover:bg-slate-50">
                    <Td>
                      <MgaLink slug={target.slug} name={target.name} />
                      <span className="mt-0.5 block">
                        <BestInClassBadge result={target.bestInClass} />
                      </span>
                    </Td>
                    <Td>
                      <StageBadge stage={target.stage} />
                    </Td>
                    <Td align="right" className="tabular">
                      {target.yearsOfExperience}
                    </Td>
                    <Td align="right">
                      <DeltaPill value={target.trend.ebitdaCagr} />
                    </Td>
                    <Td align="right" className="font-medium tabular">
                      {formatUsdCompact(target.trend.latestEbitdaUsd)}
                    </Td>
                    <Td align="right" className="tabular">
                      {formatMultiple(target.ebitdaMultiple)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Where the platform already overlaps"
          description="Tags carried by two or more acquired MGAs."
          actions={
            <Link
              href="/synergies"
              className="text-xs font-semibold text-navy-700 hover:text-navy-500"
            >
              Synergy analysis →
            </Link>
          }
        >
          <div className="space-y-4">
            {topOverlaps.map(({ dimension, groups }) => (
              <div key={dimension}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {SYNERGY_DIMENSION_LABEL[dimension]}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {groups.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      No shared tags yet
                    </span>
                  ) : (
                    groups.map((group) => (
                      <TagChip
                        key={group.tag}
                        label={group.tag}
                        shared
                        count={group.mgaCount}
                        title={`${group.mgaCount} MGAs · ${formatUsdCompact(group.totalWrittenPremiumUsd)} written premium`}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Cross-sell white space
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="text-xl font-semibold tabular text-navy-800">
                  {synergy.crossSellOpportunities.length}
                </span>{" "}
                line-of-business and region pairs where one MGA has the product
                and another has the distribution.
              </p>
              {synergy.crossSellOpportunities[0] && (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Largest:{" "}
                  <Badge tone="navy">
                    {synergy.crossSellOpportunities[0].lineOfBusiness}
                  </Badge>{" "}
                  into {synergy.crossSellOpportunities[0].geographicRegion} via{" "}
                  {synergy.crossSellOpportunities[0].candidateMgaName}.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ThesisRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          {detail}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular text-navy-800">
        {value}
      </span>
    </li>
  );
}
