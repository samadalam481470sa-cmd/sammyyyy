/**
 * Access and validation rules for the shared insurance workbooks.
 *
 * This module contains no database calls. Both server actions and tests use
 * these pure rules, so the UI cannot accidentally promise access that the
 * server would deny.
 */

export const WORKBOOK_ACCESS = {
  ORGANIZATION: "ORGANIZATION",
  RESTRICTED: "RESTRICTED",
} as const;

export type WorkbookAccess =
  (typeof WORKBOOK_ACCESS)[keyof typeof WORKBOOK_ACCESS];

export const WORKBOOK_ROLE = {
  OWNER: "OWNER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type WorkbookRole =
  (typeof WORKBOOK_ROLE)[keyof typeof WORKBOOK_ROLE];

export const MEMBER_STATUS = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
} as const;

export const POLICY_STATUS = [
  "SUBMITTED",
  "QUOTED",
  "BOUND",
  "RENEWED",
  "DECLINED",
  "LAPSED",
] as const;

export type PolicyStatus = (typeof POLICY_STATUS)[number];

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  SUBMITTED: "Submitted",
  QUOTED: "Quoted",
  BOUND: "Bound",
  RENEWED: "Renewed",
  DECLINED: "Declined",
  LAPSED: "Lapsed",
};

export type AccessSubject = {
  email: string;
  /** Whether this account belongs to Newport's organization. */
  isOrganizationUser: boolean;
};

export type WorkbookGrant = {
  email: string;
  role: string;
  status: string;
};

export type WorkbookAccessInput = {
  ownerEmail: string;
  accessMode: string;
  members: WorkbookGrant[];
};

export type WorkbookPermission = {
  canView: boolean;
  canEdit: boolean;
  canShare: boolean;
  role: WorkbookRole | null;
};

export function getWorkbookPermission(
  workbook: WorkbookAccessInput,
  subject: AccessSubject,
): WorkbookPermission {
  const email = normalizeEmail(subject.email);

  if (normalizeEmail(workbook.ownerEmail) === email) {
    return {
      canView: true,
      canEdit: true,
      canShare: true,
      role: WORKBOOK_ROLE.OWNER,
    };
  }

  const grant = workbook.members.find(
    (member) => normalizeEmail(member.email) === email,
  );
  const validRole = isWorkbookRole(grant?.role) ? grant.role : null;

  if (workbook.accessMode === WORKBOOK_ACCESS.ORGANIZATION) {
    if (!subject.isOrganizationUser) {
      return denied();
    }
    const role = validRole ?? WORKBOOK_ROLE.VIEWER;
    return permissionForRole(role);
  }

  if (workbook.accessMode === WORKBOOK_ACCESS.RESTRICTED && validRole) {
    return permissionForRole(validRole);
  }

  return denied();
}

export function isWorkbookRole(value: unknown): value is WorkbookRole {
  return Object.values(WORKBOOK_ROLE).includes(value as WorkbookRole);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lightweight but deliberate email validation for invitations. */
export function isValidInviteEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return (
    normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
  );
}

export function isPolicyStatus(value: unknown): value is PolicyStatus {
  return POLICY_STATUS.includes(value as PolicyStatus);
}

function permissionForRole(role: WorkbookRole): WorkbookPermission {
  return {
    canView: true,
    canEdit: role === WORKBOOK_ROLE.OWNER || role === WORKBOOK_ROLE.EDITOR,
    canShare: role === WORKBOOK_ROLE.OWNER,
    role,
  };
}

function denied(): WorkbookPermission {
  return { canView: false, canEdit: false, canShare: false, role: null };
}
