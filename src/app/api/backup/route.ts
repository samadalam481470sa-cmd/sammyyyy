import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Point-in-time JSON backup of the whole CRM.
 *
 * Production deployment must put this route behind the same SSO/owner check as
 * workbook sharing. The local MVP has one simulated owner account, so the file
 * is intentionally easy to download and inspect during review.
 */
export async function GET() {
  const [mgas, workbooks, clients] = await Promise.all([
    prisma.mga.findMany({
      include: {
        financials: { orderBy: { fiscalYear: "asc" } },
        programs: true,
        retailAgencies: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.workbook.findMany({
      include: {
        members: { orderBy: { email: "asc" } },
        rows: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      include: { followUps: { orderBy: { dueAt: "asc" } } },
      orderBy: { companyName: "asc" },
    }),
  ]);

  const createdAt = new Date();
  const payload = {
    schemaVersion: 1,
    product: "Newport Specialty Partners Insurance CRM",
    createdAt: createdAt.toISOString(),
    counts: {
      mgas: mgas.length,
      workbooks: workbooks.length,
      policyRows: workbooks.reduce((sum, workbook) => sum + workbook.rows.length, 0),
      workbookMembers: workbooks.reduce(
        (sum, workbook) => sum + workbook.members.length,
        0,
      ),
      clients: clients.length,
      followUps: clients.reduce((sum, client) => sum + client.followUps.length, 0),
    },
    data: { mgas, workbooks, clients },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="newport-crm-backup-${createdAt
        .toISOString()
        .slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
