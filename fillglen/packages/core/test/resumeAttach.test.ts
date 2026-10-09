import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAttachButton,
  classifyDocumentHeading,
  fileMatchesAccept,
  slotLooksFilled,
} from "../src/resumeAttach.js";
import { classifyScreenControl } from "../src/screenAct.js";
import { bytesForUpload, profileResumeText } from "../src/resumeFiles.js";
import { EMPTY_PROFILE, hydrateProfile } from "../src/types.js";

describe("resumeAttach", () => {
  it("reads the Workday-style Resume/CV and Cover Letter headings", () => {
    assert.equal(classifyDocumentHeading("Resume/CV *"), "resume");
    assert.equal(classifyDocumentHeading("Resume"), "resume");
    assert.equal(classifyDocumentHeading("Cover Letter"), "cover");
  });

  it("clicks Attach or Enter manually and never Dropbox or Drive", () => {
    assert.equal(classifyAttachButton("Attach"), "attach");
    assert.equal(classifyAttachButton("Enter manually"), "manual");
    assert.equal(classifyAttachButton("Dropbox"), "cloud");
    assert.equal(classifyAttachButton("Google Drive"), "cloud");
    assert.equal(classifyScreenControl("Dropbox"), "never");
    assert.equal(classifyScreenControl("Google Drive"), "never");
    assert.equal(classifyScreenControl("Attach"), null);
  });

  it("accepts pdf/doc/docx/txt/rtf the way the form lists them", () => {
    const accept = ".pdf,.doc,.docx,.txt,.rtf";
    assert.equal(fileMatchesAccept("sam-resume.pdf", accept), true);
    assert.equal(fileMatchesAccept("sam-resume.txt", accept), true);
    assert.equal(fileMatchesAccept("photo.png", accept), false);
  });

  it("treats an already-uploaded filename as filled", () => {
    assert.equal(slotLooksFilled("sam-resume.pdf"), true);
    assert.equal(slotLooksFilled("Accepted file types: pdf, doc"), false);
  });

  it("builds the same widget resume as a PDF and as paste text", () => {
    const profile = hydrateProfile({
      ...EMPTY_PROFILE,
      contact: { ...EMPTY_PROFILE.contact, legalName: "Sam Rivera", email: "sam@example.com" },
      rawResumeText: "Sam Rivera\nSoftware Engineer\nTypeScript React",
    });
    const packed = bytesForUpload(profile);
    assert.match(packed.name, /\.pdf$/i);
    assert.ok(packed.bytes.byteLength > 20);
    assert.match(profileResumeText(profile), /TypeScript React/);
    assert.match(profileResumeText(profile), /Sam Rivera/);
  });
});
