import type { Metadata } from "next";

import { AgencyDirectory } from "@/components/agency-directory";
import { PageHeader, StatTile } from "@/components/ui";
import { formatNumber, formatUsdCompact } from "@/lib/format";
import { getRetailAgencies } from "@/lib/queries";
import { MGA_STATUS } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Retail agencies",
};

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const agencies = await getRetailAgencies();

  const platformAgencies = agencies.filter(
    (agency) => agency.mgaStatus === MGA_STATUS.ON_PLATFORM,
  );
  const totalPremium = agencies.reduce(
    (sum, agency) => sum + (agency.annualPremiumPlacedUsd ?? 0),
    0,
  );
  const totalPolicies = agencies.reduce(
    (sum, agency) => sum + (agency.policyCount ?? 0),
    0,
  );
  const distinctRegions = new Set(agencies.map((agency) => agency.region)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Distribution"
        title="Retail agencies"
        description="The retailers that actually place the business. Each one is an independent agency appointed through a single MGA in this model — that one-MGA assumption is the first thing to confirm, since a retailer appointed with two platform MGAs would need a many-to-many relationship instead."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="brand"
          label="Retail agencies"
          value={formatNumber(agencies.length)}
          sublabel={`${platformAgencies.length} through platform MGAs`}
        />
        <StatTile
          label="Premium placed"
          value={formatUsdCompact(totalPremium)}
          sublabel="trailing twelve months"
        />
        <StatTile
          label="Policies in force"
          value={formatNumber(totalPolicies)}
          sublabel="across all appointments"
        />
        <StatTile
          label="Regions covered"
          value={formatNumber(distinctRegions)}
          sublabel="by retail footprint"
        />
      </div>

      <AgencyDirectory agencies={agencies} />
    </div>
  );
}
