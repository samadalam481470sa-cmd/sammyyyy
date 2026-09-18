import { prisma } from "./db";
import { WORKBOOK_ACCESS } from "./workbook";

export const DEMO_USER = {
  email: "mary@newportsp.com",
  name: "Mary Donovan",
  isOrganizationUser: true,
} as const;

export type WorkbookListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accessMode: string;
  isPrimary: boolean;
  ownerEmail: string;
  ownerName: string;
  rowCount: number;
  memberCount: number;
  updatedAt: string;
};

export type PolicySheetRow = {
  id: string;
  sortOrder: number;
  policyNumber: string;
  insuredName: string;
  mgaName: string | null;
  lineOfBusiness: string;
  coverageType: string;
  geographicRegion: string;
  carrier: string | null;
  producerAgency: string | null;
  underwriter: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  premiumUsd: number | null;
  commissionRate: number | null;
  status: string;
  notes: string | null;
  updatedByEmail: string | null;
  updatedAt: string;
};

export type WorkbookMemberRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invitedAt: string;
  lastActiveAt: string | null;
};

export type WorkbookDetail = WorkbookListItem & {
  rows: PolicySheetRow[];
  members: WorkbookMemberRow[];
};

export async function getWorkbooks(): Promise<WorkbookListItem[]> {
  const records = await prisma.workbook.findMany({
    include: { _count: { select: { rows: true, members: true } } },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return records.map((workbook) => ({
    id: workbook.id,
    slug: workbook.slug,
    name: workbook.name,
    description: workbook.description,
    accessMode: workbook.accessMode,
    isPrimary: workbook.isPrimary,
    ownerEmail: workbook.ownerEmail,
    ownerName: workbook.ownerName,
    rowCount: workbook._count.rows,
    memberCount:
      workbook.accessMode === WORKBOOK_ACCESS.ORGANIZATION
        ? -1
        : workbook._count.members,
    updatedAt: workbook.updatedAt.toISOString(),
  }));
}

export async function getWorkbookBySlug(
  slug: string,
): Promise<WorkbookDetail | null> {
  const workbook = await prisma.workbook.findUnique({
    where: { slug },
    include: {
      rows: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      members: {
        orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
      },
      _count: { select: { rows: true, members: true } },
    },
  });
  if (!workbook) return null;

  return {
    id: workbook.id,
    slug: workbook.slug,
    name: workbook.name,
    description: workbook.description,
    accessMode: workbook.accessMode,
    isPrimary: workbook.isPrimary,
    ownerEmail: workbook.ownerEmail,
    ownerName: workbook.ownerName,
    rowCount: workbook._count.rows,
    memberCount:
      workbook.accessMode === WORKBOOK_ACCESS.ORGANIZATION
        ? -1
        : workbook._count.members,
    updatedAt: workbook.updatedAt.toISOString(),
    rows: workbook.rows.map((row) => ({
      id: row.id,
      sortOrder: row.sortOrder,
      policyNumber: row.policyNumber,
      insuredName: row.insuredName,
      mgaName: row.mgaName,
      lineOfBusiness: row.lineOfBusiness,
      coverageType: row.coverageType,
      geographicRegion: row.geographicRegion,
      carrier: row.carrier,
      producerAgency: row.producerAgency,
      underwriter: row.underwriter,
      effectiveDate: row.effectiveDate?.toISOString() ?? null,
      expirationDate: row.expirationDate?.toISOString() ?? null,
      premiumUsd: row.premiumUsd,
      commissionRate: row.commissionRate,
      status: row.status,
      notes: row.notes,
      updatedByEmail: row.updatedByEmail,
      updatedAt: row.updatedAt.toISOString(),
    })),
    members: workbook.members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      status: member.status,
      invitedAt: member.invitedAt.toISOString(),
      lastActiveAt: member.lastActiveAt?.toISOString() ?? null,
    })),
  };
}
