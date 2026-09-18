import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpreadsheetWorkspace } from "@/components/spreadsheet-workspace";
import { PageHeader } from "@/components/ui";
import { getWorkbookBySlug, getWorkbooks } from "@/lib/workbook-queries";

export const metadata: Metadata = {
  title: "Insurance spreadsheet",
};

export const dynamic = "force-dynamic";

export default async function SpreadsheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string }>;
}) {
  const [{ book }, workbooks] = await Promise.all([
    searchParams,
    getWorkbooks(),
  ]);
  const selected =
    workbooks.find((workbook) => workbook.slug === book) ??
    workbooks.find((workbook) => workbook.isPrimary) ??
    workbooks[0];
  if (!selected) notFound();

  const workbook = await getWorkbookBySlug(selected.slug);
  if (!workbook) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insurance CRM · shared operations"
        title="Insurance spreadsheet"
        description="Newport's live policy and submission register. Edit any cell, filter the book, export visible rows, or share the main register with everyone at Newport. Restricted workbooks grant access one email address at a time and support hundreds of members."
      />
      <SpreadsheetWorkspace workbook={workbook} workbooks={workbooks} />
    </div>
  );
}
