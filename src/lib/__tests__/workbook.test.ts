import { describe, expect, it } from "vitest";

import {
  getWorkbookPermission,
  isPolicyStatus,
  isValidInviteEmail,
  normalizeEmail,
  WORKBOOK_ACCESS,
  WORKBOOK_ROLE,
} from "../workbook";

const owner = "mary@newportsp.com";

describe("getWorkbookPermission", () => {
  it("lets every organization user view the main workbook", () => {
    const permission = getWorkbookPermission(
      { ownerEmail: owner, accessMode: WORKBOOK_ACCESS.ORGANIZATION, members: [] },
      { email: "analyst@newportsp.com", isOrganizationUser: true },
    );
    expect(permission).toEqual({
      canView: true,
      canEdit: false,
      canShare: false,
      role: WORKBOOK_ROLE.VIEWER,
    });
  });

  it("denies an outside account even when the workbook is organization-wide", () => {
    const permission = getWorkbookPermission(
      { ownerEmail: owner, accessMode: WORKBOOK_ACCESS.ORGANIZATION, members: [] },
      { email: "outside@example.com", isOrganizationUser: false },
    );
    expect(permission.canView).toBe(false);
  });

  it("honors an explicit editor role on an organization workbook", () => {
    const permission = getWorkbookPermission(
      {
        ownerEmail: owner,
        accessMode: WORKBOOK_ACCESS.ORGANIZATION,
        members: [
          {
            email: "analyst@newportsp.com",
            role: WORKBOOK_ROLE.EDITOR,
            status: "ACTIVE",
          },
        ],
      },
      { email: "ANALYST@NEWPORTSP.COM", isOrganizationUser: true },
    );
    expect(permission.canEdit).toBe(true);
    expect(permission.canShare).toBe(false);
  });

  it("requires an explicit grant for a restricted workbook", () => {
    const workbook = {
      ownerEmail: owner,
      accessMode: WORKBOOK_ACCESS.RESTRICTED,
      members: [],
    };
    expect(
      getWorkbookPermission(workbook, {
        email: "analyst@newportsp.com",
        isOrganizationUser: true,
      }).canView,
    ).toBe(false);
  });

  it("lets an invited editor open and edit a restricted workbook", () => {
    const permission = getWorkbookPermission(
      {
        ownerEmail: owner,
        accessMode: WORKBOOK_ACCESS.RESTRICTED,
        members: [
          {
            email: "analyst@newportsp.com",
            role: WORKBOOK_ROLE.EDITOR,
            status: "INVITED",
          },
        ],
      },
      { email: "analyst@newportsp.com", isOrganizationUser: true },
    );
    expect(permission).toMatchObject({
      canView: true,
      canEdit: true,
      canShare: false,
      role: WORKBOOK_ROLE.EDITOR,
    });
  });

  it("always gives the owner full control, regardless of access mode", () => {
    for (const accessMode of Object.values(WORKBOOK_ACCESS)) {
      const permission = getWorkbookPermission(
        { ownerEmail: owner, accessMode, members: [] },
        { email: " Mary@NewportSP.com ", isOrganizationUser: true },
      );
      expect(permission).toEqual({
        canView: true,
        canEdit: true,
        canShare: true,
        role: WORKBOOK_ROLE.OWNER,
      });
    }
  });
});

describe("email normalization and validation", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeEmail("  MARY@NewportSP.com ")).toBe("mary@newportsp.com");
  });

  it("accepts a normal business email", () => {
    expect(isValidInviteEmail("analyst@newportsp.com")).toBe(true);
  });

  it.each(["", "mary", "mary@", "@newportsp.com", "mary @newportsp.com"])(
    "rejects invalid invite address %j",
    (email) => {
      expect(isValidInviteEmail(email)).toBe(false);
    },
  );
});

describe("policy status validation", () => {
  it.each(["SUBMITTED", "QUOTED", "BOUND", "RENEWED", "DECLINED", "LAPSED"])(
    "accepts %s",
    (status) => expect(isPolicyStatus(status)).toBe(true),
  );

  it("rejects an arbitrary status", () => {
    expect(isPolicyStatus("APPROVED")).toBe(false);
  });
});
