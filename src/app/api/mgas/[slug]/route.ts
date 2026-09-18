import { NextResponse } from "next/server";

import { getMgaBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/mgas/:slug — one MGA with financials, programs and retailers. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const mga = await getMgaBySlug(slug);

  if (!mga) {
    return NextResponse.json(
      { error: `No MGA with slug "${slug}".` },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: mga });
}
