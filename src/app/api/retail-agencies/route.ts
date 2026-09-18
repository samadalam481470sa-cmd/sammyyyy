import { NextResponse } from "next/server";

import { getRetailAgencies } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/retail-agencies?region=Northeast&mgaSlug=harborline-underwriters
 *
 * The full retailer directory, optionally narrowed by region or by the MGA the
 * retailer is appointed through.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const mgaSlug = url.searchParams.get("mgaSlug");

  let agencies = await getRetailAgencies();

  if (region) {
    agencies = agencies.filter((agency) => agency.region === region);
  }
  if (mgaSlug) {
    agencies = agencies.filter((agency) => agency.mgaSlug === mgaSlug);
  }

  return NextResponse.json({ count: agencies.length, data: agencies });
}
