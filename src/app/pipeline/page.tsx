import { prisma } from "@/lib/prisma";
import { withDerivedMetrics } from "@/lib/metrics";
import PipelineTable from "@/components/PipelineTable";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const targets = await prisma.mga.findMany({
    where: { status: "PIPELINE" },
    include: { financials: true, insurancePrograms: true, retailAgencies: true },
  });

  const enriched = targets.map(withDerivedMetrics);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Corporate Development
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          M&amp;A Pipeline Dashboard
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Track target MGAs currently in the market. Sort and filter for &ldquo;Best in
          Class&rdquo; metrics — highest EBITDA growth, 20+ years of experience, and specific
          geographic regions.
        </p>
      </section>

      <PipelineTable targets={enriched} />
    </div>
  );
}
