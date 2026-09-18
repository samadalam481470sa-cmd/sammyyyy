import { NextResponse } from "next/server";

import { getPipelineTargets, getPortfolioCompanies } from "@/lib/queries";
import { MGA_STATUS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/**
 * GET /api/mgas?status=PIPELINE|ON_PLATFORM&includeProjections=true
 *
 * The same read models the dashboards render, exposed as JSON so the corp-dev
 * team can pull the pipeline into a spreadsheet or a board deck without asking
 * for an export feature.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const includeProjections =
    url.searchParams.get("includeProjections") === "true";

  if (status && status !== MGA_STATUS.PIPELINE && status !== MGA_STATUS.ON_PLATFORM) {
    return NextResponse.json(
      {
        error: `Unknown status "${status}". Expected ${MGA_STATUS.PIPELINE} or ${MGA_STATUS.ON_PLATFORM}.`,
      },
      { status: 400 },
    );
  }

  if (status === MGA_STATUS.PIPELINE) {
    const data = await getPipelineTargets({ includeProjections });
    return NextResponse.json({ status, count: data.length, data });
  }

  if (status === MGA_STATUS.ON_PLATFORM) {
    const data = await getPortfolioCompanies();
    return NextResponse.json({ status, count: data.length, data });
  }

  const [pipeline, portfolio] = await Promise.all([
    getPipelineTargets({ includeProjections }),
    getPortfolioCompanies(),
  ]);

  return NextResponse.json({
    count: pipeline.length + portfolio.length,
    pipeline,
    portfolio,
  });
}
