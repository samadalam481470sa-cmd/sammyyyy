/**
 * Deterministic insurance workbook demo data.
 *
 * The primary sheet is organization-wide. The deal-room sheet is restricted
 * and has 240 individually named grants, proving the member UI and data model
 * are designed for hundreds of people rather than a handful of avatar chips.
 */

import {
  MEMBER_STATUS,
  WORKBOOK_ACCESS,
  WORKBOOK_ROLE,
} from "../src/lib/workbook";

const insureds = [
  "Hudson Valley Fabrication",
  "Brightwater Hospitality Group",
  "Mason Ridge Logistics",
  "Tideway Marine Services",
  "Silver Oak Medical Partners",
  "Redwood Property Holdings",
  "Greenline Environmental",
  "Northstar Technology Labs",
  "Ironworks Construction",
  "Heritage Food Markets",
  "Atlas Fleet Services",
  "Crescent Bay Apartments",
  "Summit Allied Health",
  "Keystone Storage Systems",
  "Bluebird Retail Group",
  "Canyon Energy Services",
] as const;

const carriers = [
  "Everest Specialty",
  "Trisura Specialty",
  "Clear Blue Specialty",
  "Accredited Specialty",
  "State National",
  "Palomar Specialty",
  "Spinnaker",
  "Lloyd's Syndicate 2121",
] as const;

const underwriters = [
  "Ellen Marchetti",
  "Doug Ferrante",
  "Raymond Salazar",
  "Gwen Ostrowski",
  "Camille Boudreaux",
  "Nadia Farouk",
] as const;

const mgaNames = [
  "Harborline Underwriters",
  "Cascade Specialty Risk",
  "Lone Star Program Managers",
  "Meridian Casualty Group",
  "Gulf Bay Underwriters",
  "Summit Professional Lines",
] as const;

const agencies = [
  "Jake Whitmore Insurance Group",
  "Rainier Commercial Partners",
  "Trinity Fleet Insurance Services",
  "Buckeye Commercial Group",
  "Azalea Coast Insurance",
  "Mile High Professional Risk",
] as const;

const productRows = [
  ["Commercial Property", "Excess & Surplus", "Northeast"],
  ["General Liability", "Admitted Primary", "Mid-Atlantic"],
  ["Commercial Auto", "Excess & Surplus", "Texas"],
  ["Workers' Compensation", "Admitted Primary", "Midwest"],
  ["Inland Marine", "Monoline", "Gulf South"],
  ["Professional Liability", "Program Business", "Nationwide"],
  ["Environmental", "Excess & Surplus", "Pacific Northwest"],
  ["Cyber", "Monoline", "Mountain West"],
] as const;

const statuses = [
  "BOUND",
  "RENEWED",
  "QUOTED",
  "SUBMITTED",
  "BOUND",
  "BOUND",
  "DECLINED",
  "LAPSED",
] as const;

function date(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function buildPolicyRows(count: number, prefix: string, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + offset;
    const product = productRows[n % productRows.length];
    const effectiveMonth = (n % 12) + 1;
    const effectiveDay = ((n * 7) % 24) + 1;
    const premium = 48_000 + ((n * 37_913) % 1_175_000);
    const status = statuses[n % statuses.length];

    return {
      sortOrder: (index + 1) * 100,
      policyNumber: `${prefix}-${String(260000 + n).padStart(6, "0")}`,
      insuredName: `${insureds[n % insureds.length]}${n >= insureds.length ? ` ${Math.floor(n / insureds.length) + 1}` : ""}`,
      mgaName: mgaNames[n % mgaNames.length],
      lineOfBusiness: product[0],
      coverageType: product[1],
      geographicRegion: product[2],
      carrier: carriers[(n * 3) % carriers.length],
      producerAgency: agencies[(n * 5) % agencies.length],
      underwriter: underwriters[n % underwriters.length],
      effectiveDate: date(2026, effectiveMonth, effectiveDay),
      expirationDate: date(2027, effectiveMonth, effectiveDay),
      premiumUsd: premium,
      commissionRate: 0.12 + (n % 7) * 0.01,
      status,
      notes:
        status === "DECLINED"
          ? "Declined — outside current appetite."
          : status === "LAPSED"
            ? "Renewal follow-up required."
            : n % 5 === 0
              ? "Board reporting account."
              : null,
      updatedByEmail: `${underwriters[n % underwriters.length]
        .toLowerCase()
        .replace(" ", ".")}@newportsp.com`,
    };
  });
}

const firstNames = [
  "Avery",
  "Jordan",
  "Morgan",
  "Taylor",
  "Cameron",
  "Riley",
  "Quinn",
  "Parker",
  "Drew",
  "Casey",
  "Reese",
  "Alex",
] as const;

const lastNames = [
  "Adams",
  "Bennett",
  "Chen",
  "Diaz",
  "Evans",
  "Foster",
  "Gupta",
  "Hayes",
  "Irwin",
  "Jones",
  "Kim",
  "Lopez",
  "Murray",
  "Nguyen",
  "Owens",
  "Patel",
  "Reed",
  "Singh",
  "Turner",
  "Walker",
] as const;

export function buildWorkbookMembers(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const serial = Math.floor(index / (firstNames.length * lastNames.length)) + 1;
    return {
      email: `${firstName}.${lastName}${serial > 1 ? serial : ""}@newportsp.com`.toLowerCase(),
      name: `${firstName} ${lastName}`,
      role:
        index < 32
          ? WORKBOOK_ROLE.EDITOR
          : WORKBOOK_ROLE.VIEWER,
      status:
        index % 7 === 0 ? MEMBER_STATUS.INVITED : MEMBER_STATUS.ACTIVE,
      lastActiveAt:
        index % 7 === 0
          ? null
          : new Date(Date.UTC(2026, 8, 18, 20 - (index % 12), index % 60)),
    };
  });
}

export const WORKBOOK_SEEDS = [
  {
    slug: "insurance-master-register",
    name: "Insurance Master Register",
    description:
      "Newport's company-wide policy and submission register. Every Newport user can open it; editors maintain the live book.",
    accessMode: WORKBOOK_ACCESS.ORGANIZATION,
    isPrimary: true,
    ownerEmail: "mary@newportsp.com",
    ownerName: "Mary Donovan",
    members: [
      {
        email: "ellen.marchetti@newportsp.com",
        name: "Ellen Marchetti",
        role: WORKBOOK_ROLE.EDITOR,
        status: MEMBER_STATUS.ACTIVE,
        lastActiveAt: new Date(Date.UTC(2026, 8, 18, 20, 52)),
      },
      {
        email: "doug.ferrante@newportsp.com",
        name: "Doug Ferrante",
        role: WORKBOOK_ROLE.EDITOR,
        status: MEMBER_STATUS.ACTIVE,
        lastActiveAt: new Date(Date.UTC(2026, 8, 18, 20, 47)),
      },
    ],
    rows: buildPolicyRows(72, "NSP"),
  },
  {
    slug: "project-beacon-deal-room",
    name: "Project Beacon — Deal Room",
    description:
      "Restricted diligence register for the Beacon Hill acquisition. Access is granted one email address at a time.",
    accessMode: WORKBOOK_ACCESS.RESTRICTED,
    isPrimary: false,
    ownerEmail: "mary@newportsp.com",
    ownerName: "Mary Donovan",
    members: buildWorkbookMembers(240),
    rows: buildPolicyRows(18, "BHS", 100),
  },
] as const;
