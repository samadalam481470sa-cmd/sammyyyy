import type { Metadata } from "next";

import { SynergyWorkbench } from "@/components/synergy-workbench";
import { PageHeader, StatTile } from "@/components/ui";
import { formatNumber, formatUsdCompact } from "@/lib/format";
import { getSynergyAnalysis } from "@/lib/queries";
import { SYNERGY_DIMENSIONS } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Synergy analysis",
};

export const dynamic = "force-dynamic";

export default async function SynergiesPage() {
  const synergy = await getSynergyAnalysis();

  const overlapCount = Object.values(synergy.overlapsByDimension).reduce(
    (sum, groups) => sum + groups.filter((group) => group.isOverlap).length,
    0,
  );
  const exclusiveCount = Object.values(synergy.overlapsByDimension).reduce(
    (sum, groups) => sum + groups.filter((group) => !group.isOverlap).length,
    0,
  );
  const sharedRegionPremium = synergy.overlapsByDimension[
    SYNERGY_DIMENSIONS.geographicRegion
  ]
    .filter((group) => group.isOverlap)
    .reduce((sum, group) => sum + group.totalWrittenPremiumUsd, 0);
  const strongestPair = synergy.pairOverlaps[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio strategy"
        title="Synergy analysis"
        description="Computed over acquired MGAs only — an overlap between two companies Newport does not own is not a synergy. Everything here comes from joining program tags across the portfolio, so a single program added to one MGA changes the answer immediately."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="gold"
          label="Overlapping tags"
          value={formatNumber(overlapCount)}
          sublabel="carried by two or more MGAs"
        />
        <StatTile
          label="Single-source capabilities"
          value={formatNumber(exclusiveCount)}
          sublabel="held by exactly one MGA"
        />
        <StatTile
          label="Premium in shared regions"
          value={formatUsdCompact(sharedRegionPremium)}
          sublabel="where two MGAs already write"
        />
        <StatTile
          label="Cross-sell opportunities"
          value={formatNumber(synergy.crossSellOpportunities.length)}
          sublabel={
            strongestPair
              ? `closest pair: ${strongestPair.aMgaName.split(" ")[0]} / ${strongestPair.bMgaName.split(" ")[0]}`
              : undefined
          }
        />
      </div>

      <SynergyWorkbench
        companies={synergy.companies}
        overlapsByDimension={synergy.overlapsByDimension}
        pairOverlaps={synergy.pairOverlaps}
        crossSellOpportunities={synergy.crossSellOpportunities}
      />
    </div>
  );
}
