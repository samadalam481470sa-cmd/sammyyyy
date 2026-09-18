"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { DEMO_USER } from "@/lib/workbook-queries";
import {
  isPolicyStatus,
  isValidInviteEmail,
  isWorkbookRole,
  normalizeEmail,
  WORKBOOK_ACCESS,
  WORKBOOK_ROLE,
} from "@/lib/workbook";

export type ActionResult = { ok: true } | { ok: false; error: string };

const EDITABLE_TEXT_FIELDS = new Set([
  "policyNumber",
  "insuredName",
  "mgaName",
  "lineOfBusiness",
  "coverageType",
  "geographicRegion",
  "carrier",
  "producerAgency",
  "underwriter",
  "notes",
]);
const EDITABLE_DATE_FIELDS = new Set(["effectiveDate", "expirationDate"]);
const EDITABLE_NUMBER_FIELDS = new Set(["premiumUsd", "commissionRate"]);

/**
 * Inline cell edits. The field allowlist is the security boundary here; never
 * pass a client-provided object straight into Prisma.
 */
export async function updatePolicyCell(
  workbookSlug: string,
  rowId: string,
  field: string,
  rawValue: string,
): Promise<ActionResult> {
  try {
    const row = await prisma.policyRow.findUnique({
      where: { id: rowId },
      include: { workbook: true },
    });
    if (!row || row.workbook.slug !== workbookSlug) {
      return { ok: false, error: "That policy row no longer exists." };
    }

    let value: string | number | Date | null;
    if (EDITABLE_TEXT_FIELDS.has(field)) {
      value = rawValue.trim() || null;
      if ((field === "policyNumber" || field === "insuredName") && !value) {
        return { ok: false, error: "Policy number and insured are required." };
      }
    } else if (EDITABLE_DATE_FIELDS.has(field)) {
      value = rawValue ? new Date(`${rawValue}T00:00:00.000Z`) : null;
      if (value && Number.isNaN(value.getTime())) {
        return { ok: false, error: "Enter a valid date." };
      }
    } else if (EDITABLE_NUMBER_FIELDS.has(field)) {
      value = rawValue === "" ? null : Number(rawValue);
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        return { ok: false, error: "Enter a non-negative number." };
      }
    } else if (field === "status") {
      if (!isPolicyStatus(rawValue)) {
        return { ok: false, error: "Unknown policy status." };
      }
      value = rawValue;
    } else {
      return { ok: false, error: "That column is not editable." };
    }

    await prisma.policyRow.update({
      where: { id: rowId },
      data: {
        [field]: value,
        updatedByEmail: DEMO_USER.email,
      },
    });
    revalidateWorkbook(workbookSlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "The edit could not be saved. Try again." };
  }
}

export async function addPolicyRow(
  workbookSlug: string,
): Promise<ActionResult & { rowId?: string }> {
  try {
    const workbook = await prisma.workbook.findUnique({
      where: { slug: workbookSlug },
      include: { rows: { orderBy: { sortOrder: "desc" }, take: 1 } },
    });
    if (!workbook) return { ok: false, error: "Workbook not found." };

    const next = (workbook.rows[0]?.sortOrder ?? 0) + 100;
    const row = await prisma.policyRow.create({
      data: {
        workbookId: workbook.id,
        sortOrder: next,
        policyNumber: `NEW-${String(next).padStart(6, "0")}`,
        insuredName: "New insured",
        lineOfBusiness: "General Liability",
        coverageType: "Excess & Surplus",
        geographicRegion: "Nationwide",
        status: "SUBMITTED",
        updatedByEmail: DEMO_USER.email,
      },
    });
    revalidateWorkbook(workbookSlug);
    return { ok: true, rowId: row.id };
  } catch {
    return { ok: false, error: "The row could not be added." };
  }
}

export async function deletePolicyRow(
  workbookSlug: string,
  rowId: string,
): Promise<ActionResult> {
  const row = await prisma.policyRow.findUnique({
    where: { id: rowId },
    include: { workbook: true },
  });
  if (!row || row.workbook.slug !== workbookSlug) {
    return { ok: false, error: "That row no longer exists." };
  }
  await prisma.policyRow.delete({ where: { id: rowId } });
  revalidateWorkbook(workbookSlug);
  return { ok: true };
}

export async function updateWorkbookAccess(
  workbookSlug: string,
  accessMode: string,
): Promise<ActionResult> {
  if (!Object.values(WORKBOOK_ACCESS).includes(accessMode as never)) {
    return { ok: false, error: "Unknown access mode." };
  }
  const workbook = await prisma.workbook.findUnique({
    where: { slug: workbookSlug },
  });
  if (!workbook) return { ok: false, error: "Workbook not found." };
  if (
    workbook.isPrimary &&
    accessMode !== WORKBOOK_ACCESS.ORGANIZATION
  ) {
    return {
      ok: false,
      error: "The main company register must stay available to everyone.",
    };
  }
  await prisma.workbook.update({
    where: { id: workbook.id },
    data: { accessMode },
  });
  revalidateWorkbook(workbookSlug);
  return { ok: true };
}

export async function inviteWorkbookMember(
  workbookSlug: string,
  email: string,
  role: string,
): Promise<ActionResult> {
  const normalized = normalizeEmail(email);
  if (!isValidInviteEmail(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isWorkbookRole(role) || role === WORKBOOK_ROLE.OWNER) {
    return { ok: false, error: "Invite the person as an editor or viewer." };
  }
  const workbook = await prisma.workbook.findUnique({
    where: { slug: workbookSlug },
  });
  if (!workbook) return { ok: false, error: "Workbook not found." };
  if (normalized === normalizeEmail(workbook.ownerEmail)) {
    return { ok: false, error: "The owner already has full access." };
  }

  await prisma.workbookMember.upsert({
    where: {
      workbookId_email: { workbookId: workbook.id, email: normalized },
    },
    create: {
      workbookId: workbook.id,
      email: normalized,
      role,
      status: "INVITED",
    },
    update: { role },
  });
  revalidateWorkbook(workbookSlug);
  return { ok: true };
}

export async function updateWorkbookMemberRole(
  workbookSlug: string,
  memberId: string,
  role: string,
): Promise<ActionResult> {
  if (!isWorkbookRole(role) || role === WORKBOOK_ROLE.OWNER) {
    return { ok: false, error: "Choose editor or viewer." };
  }
  const member = await prisma.workbookMember.findUnique({
    where: { id: memberId },
    include: { workbook: true },
  });
  if (!member || member.workbook.slug !== workbookSlug) {
    return { ok: false, error: "That member no longer exists." };
  }
  await prisma.workbookMember.update({
    where: { id: memberId },
    data: { role },
  });
  revalidateWorkbook(workbookSlug);
  return { ok: true };
}

export async function removeWorkbookMember(
  workbookSlug: string,
  memberId: string,
): Promise<ActionResult> {
  const member = await prisma.workbookMember.findUnique({
    where: { id: memberId },
    include: { workbook: true },
  });
  if (!member || member.workbook.slug !== workbookSlug) {
    return { ok: false, error: "That member no longer exists." };
  }
  await prisma.workbookMember.delete({ where: { id: memberId } });
  revalidateWorkbook(workbookSlug);
  return { ok: true };
}

function revalidateWorkbook(slug: string) {
  revalidatePath("/spreadsheets");
  revalidatePath(`/spreadsheets/${slug}`);
}
