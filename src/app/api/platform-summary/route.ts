import { NextResponse } from "next/server";

import { getPlatformSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/platform-summary — the headline figures on the executive overview. */
export async function GET() {
  const summary = await getPlatformSummary();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    data: summary,
  });
}
