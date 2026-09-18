import { NextResponse } from "next/server";

import { getSynergyAnalysis } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/synergies
 *
 * Overlap groups, pairwise similarity and cross-sell white space across the
 * acquired portfolio — the computation behind the synergy screen, so a board
 * pack can quote the same numbers the UI shows.
 */
export async function GET() {
  const analysis = await getSynergyAnalysis();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mgaCount: analysis.companies.length,
    overlapsByDimension: analysis.overlapsByDimension,
    pairOverlaps: analysis.pairOverlaps,
    crossSellOpportunities: analysis.crossSellOpportunities,
  });
}
