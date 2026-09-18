import type { Metadata } from "next";

import { PipelineExplorer } from "@/components/pipeline-explorer";
import { PageHeader } from "@/components/ui";
import { getPipelineTargets } from "@/lib/queries";

export const metadata: Metadata = {
  title: "M&A pipeline",
};

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const targets = await getPipelineTargets();

  // Filter options come from the targets actually in the pipeline rather than
  // the full taxonomy, so the corp-dev team never ticks a box that can only
  // return nothing.
  const regions = [
    ...new Set(targets.flatMap((target) => target.geographicRegions)),
  ].sort();
  const linesOfBusiness = [
    ...new Set(targets.flatMap((target) => target.linesOfBusiness)),
  ].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Corporate development"
        title="M&A pipeline"
        description="Every MGA Newport is tracking in market, screened against the acquisition thesis. Growth is computed from the target's own fiscal-year EBITDA history, and the badge on each row names the criterion a target misses rather than only whether it passed."
      />
      <PipelineExplorer
        targets={targets}
        regions={regions}
        linesOfBusiness={linesOfBusiness}
      />
    </div>
  );
}
