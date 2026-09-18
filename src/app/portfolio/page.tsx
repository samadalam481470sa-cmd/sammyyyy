import type { Metadata } from "next";
import Link from "next/link";

import { PlatformEbitdaChart } from "@/components/charts";
import { PortfolioExplorer } from "@/components/portfolio-explorer";
import { PageHeader, Panel, StatTile } from "@/components/ui";
import { formatNumber, formatPercent, formatUsdCompact } from "@/lib/format";
import { getPlatformSummary, getSynergyAnalysis } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Aggregated portfolio",
};

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [summary, synergy] = await Promise.all([
    getPlatformSummary(),
    getSynergyAnalysis(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="One platform"
        title="Aggregated portfolio"
        description="Every MGA Newport owns today, rolled up into a single view. The capability matrix is the part to look at first: it shows where two or more MGAs already do the same thing, which is where consolidation and shared carrier leverage live."
        actions={
          <Link
            href="/synergies"
            className="rounded-lg bg-navy-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-700"
          >
            Open synergy analysis
          </Link>
        }
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
          label="Gross written premium"
          value={formatUsdCompact(summary.platformWrittenPremiumUsd)}
          sublabel={`${summary.programCount} active programs`}
        />
        <StatTile
          label="MGAs on platform"
          value={formatNumber(summary.onPlatformCount)}
          sublabel={`${summary.weightedAverageYearsOfExperience?.toFixed(0) ?? "—"} yrs avg tenure, EBITDA weighted`}
        />
        <StatTile
          label="Retail agencies"
          value={formatNumber(summary.retailAgencyCount)}
          sublabel={`across ${summary.distinctRegions} regions and ${summary.distinctLinesOfBusiness} lines`}
        />
      </div>

      <Panel
        title="Aggregate EBITDA"
        description="Sum of every acquired MGA's fiscal-year EBITDA. All six report across FY21–FY25, so this series is comparable year to year rather than stepping up as deals closed — the tooltip states the reporting count for each year."
      >
        <PlatformEbitdaChart data={summary.aggregateEbitdaByYear} />
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Invested capital</dt>
            <dd className="mt-0.5 text-base font-semibold tabular text-slate-900">
              {formatUsdCompact(summary.investedCapitalUsd)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Implied platform revenue</dt>
            <dd className="mt-0.5 text-base font-semibold tabular text-slate-900">
              {formatUsdCompact(summary.platformRevenueUsd)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">EBITDA margin</dt>
            <dd className="mt-0.5 text-base font-semibold tabular text-slate-900">
              {formatPercent(
                summary.platformRevenueUsd > 0
                  ? summary.platformEbitdaUsd / summary.platformRevenueUsd
                  : null,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Live pipeline</dt>
            <dd className="mt-0.5 text-base font-semibold tabular text-slate-900">
              {formatNumber(summary.pipelineCount)} targets
            </dd>
          </div>
        </dl>
      </Panel>

      <PortfolioExplorer
        companies={synergy.companies}
        overlapsByDimension={synergy.overlapsByDimension}
      />
    </div>
  );
}
