import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAttachButton,
  classifyDocumentHeading,
  fileMatchesAccept,
  pageHasBothDocumentSlots,
  resumeMayUseSlot,
  shouldClickAttachButton,
  slotFromNearbyText,
  slotLooksFilled,
} from "../src/resumeAttach.js";
import { classifyScreenControl } from "../src/screenAct.js";
import { applicationFamily, applicationShape, jobComplexityBoost } from "../src/applicationShape.js";
import { bytesForUpload, profileResumeText } from "../src/resumeFiles.js";
import { resolveResumeSource } from "../src/resumeSource.js";
import { EMPTY_PROFILE, hydrateProfile } from "../src/types.js";
import { bytesToBase64 } from "../src/resumeFiles.js";

describe("resumeAttach", () => {
  it("reads the Workday-style Resume/CV and Cover Letter headings", () => {
    assert.equal(classifyDocumentHeading("Resume/CV *"), "resume");
    assert.equal(classifyDocumentHeading("Resume"), "resume");
    assert.equal(classifyDocumentHeading("Cover Letter"), "cover");
    assert.equal(
      classifyDocumentHeading("Resume/CV * Attach Dropbox Google Drive Enter manually Cover Letter"),
      "unknown"
    );
    assert.equal(pageHasBothDocumentSlots("Resume/CV *\nAttach\nCover Letter"), true);
    assert.equal(slotFromNearbyText("", "Cover Letter", "Resume/CV Attach Cover Letter"), "cover");
    assert.equal(slotFromNearbyText("", "Resume/CV *", "Resume/CV Attach Cover Letter"), "resume");
    assert.equal(resumeMayUseSlot("cover", true), false);
    assert.equal(resumeMayUseSlot("resume", true), true);
    assert.equal(resumeMayUseSlot("unknown", true), false);
    assert.equal(shouldClickAttachButton("workday"), false);
    assert.equal(shouldClickAttachButton("greenhouse"), true);
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

  it("loops PDF, then paste, then library to find the resume", () => {
    const pdf = hydrateProfile({
      ...EMPTY_PROFILE,
      documents: [
        {
          id: "master-resume",
          kind: "master-resume",
          name: "Sam-Rivera.pdf",
          mime: "application/pdf",
          text: "Sam Rivera PDF resume body with experience and skills",
          base64: bytesToBase64(new TextEncoder().encode("%PDF-1.4 resume")),
        },
      ],
    });
    assert.equal(resolveResumeSource(pdf).from, "pdf");
    assert.equal(resolveResumeSource(pdf).fileName, "Sam-Rivera.pdf");
    const pasted = resolveResumeSource(EMPTY_PROFILE, {
      paste: "Sam Rivera\nSoftware Engineer\nExperience at North Glen\nSkills TypeScript",
    });
    assert.equal(pasted.from, "paste");
    const lib = resolveResumeSource(EMPTY_PROFILE, {
      library: ["Sam Rivera curriculum vitae. Education and skills. Engineer."],
    });
    assert.equal(lib.from, "library");
  });

  it("prefers Workday multi-step senior roles over basic one-pagers", () => {
    assert.equal(applicationFamily("https://acme.wd5.myworkdayjobs.com/en-US/job"), "workday");
    assert.equal(applicationShape("https://acme.wd5.myworkdayjobs.com/x").preferResumeClick, "manual");
    const senior = jobComplexityBoost("https://acme.wd5.myworkdayjobs.com/x", "Senior Software Engineer");
    const intern = jobComplexityBoost("https://jobs.lever.co/cafe/1", "Help Desk Intern");
    assert.ok(senior.boost > intern.boost);
  });
});
