import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDownloadable,
  extractDocxText,
  extractPdfText,
  extractResumeText,
  parseResumeFile,
  textToDocx,
  textToPdf,
} from "../src/resumeFiles.js";
import {
  classifyScreenControl,
  fillPaceForPage,
  looksLikeJobListingCopy,
  pageLooksDetected,
  pickScreenAction,
  pickScreenActions,
} from "../src/screenAct.js";
import { EMPTY_PROFILE } from "../src/types.js";

describe("resume files", () => {
  it("round-trips DOCX text", () => {
    const bytes = textToDocx("Sam Rivera\nSoftware Engineer\nSkills: TypeScript, React");
    const text = extractDocxText(bytes);
    assert.match(text, /Sam Rivera/);
    assert.match(text, /TypeScript/);
  });

  it("round-trips a generated PDF", () => {
    const bytes = textToPdf("Sam Rivera\nDallas TX\nTypeScript APIs", "Resume");
    const text = extractPdfText(bytes);
    assert.match(text, /Sam Rivera/);
    assert.match(text, /TypeScript/);
  });

  it("parses a pasted-style txt upload", async () => {
    const raw = "Sam Rivera\nsam@example.com\n2145550100\nDallas, TX\nSkills: TypeScript, React\nSoftware Engineer at North Glen";
    const profile = await parseResumeFile("resume.txt", new TextEncoder().encode(raw));
    assert.equal(profile.contact.email, "sam@example.com");
    assert.ok(profile.documents[0]?.base64);
    assert.equal(extractResumeText("resume.txt", new TextEncoder().encode(raw)).includes("Sam Rivera"), true);
  });

  it("builds downloadable resume and cover files", () => {
    const profile = {
      ...EMPTY_PROFILE,
      contact: { ...EMPTY_PROFILE.contact, legalName: "Sam Rivera", email: "sam@example.com" },
      rawResumeText: "Sam Rivera. TypeScript.",
    };
    const pdf = buildDownloadable(profile, "resume", "pdf");
    const docx = buildDownloadable(profile, "cover", "docx");
    const txt = buildDownloadable(profile, "resume", "txt");
    assert.equal(pdf.mime, "application/pdf");
    assert.match(new TextDecoder().decode(pdf.bytes).slice(0, 8), /%PDF/);
    assert.ok(docx.bytes[0] === 0x50 && docx.bytes[1] === 0x4b);
    assert.match(new TextDecoder().decode(txt.bytes), /Sam Rivera/);
  });
});

describe("screen pace", () => {
  it("slows down when a page looks like it detected automation and does not stop", () => {
    assert.equal(pageLooksDetected("We detected unusual activity. Please slow down."), true);
    assert.equal(fillPaceForPage("We detected unusual activity."), "slow");
    assert.equal(fillPaceForPage("First name"), "fast");
  });

  it("will click cookie and upload controls and will not click logout", () => {
    assert.equal(classifyScreenControl("Accept all cookies"), "act");
    assert.equal(classifyScreenControl("Upload resume"), "act");
    assert.equal(classifyScreenControl("Add education"), "act");
    assert.equal(classifyScreenControl("Log out"), "never");
    assert.equal(classifyScreenControl("Withdraw application"), "never");
    assert.equal(classifyScreenControl("Donate now"), "never");
    assert.equal(classifyScreenControl("Pay now"), "never");
    assert.equal(classifyScreenControl("Easy Apply"), "never");
    assert.equal(pickScreenAction([{ label: "Log out" }, { label: "Accept cookies" }])?.label, "Accept cookies");
  });

  it("does not steal Sign Up, last application, Next, or native file pickers", () => {
    assert.equal(classifyScreenControl("Create Account"), null);
    assert.equal(classifyScreenControl("Use My Last Application"), null);
    assert.equal(classifyScreenControl("Sign Up"), null);
    assert.equal(classifyScreenControl("Next"), null);
    assert.equal(classifyScreenControl("Submit application"), null);
    assert.equal(classifyScreenControl("Choose File"), null);
    assert.equal(
      pickScreenAction([{ label: "Create Account" }, { label: "Accept all cookies" }])?.label,
      "Accept all cookies"
    );
  });

  it("skips fingerprints so the same banner is not clicked forever", () => {
    const buttons = [
      { label: "Accept all cookies", automationId: "cookie" },
      { label: "Add experience" },
    ];
    const first = pickScreenAction(buttons);
    assert.equal(first?.label, "Accept all cookies");
    const second = pickScreenAction(buttons, [first!.fingerprint]);
    assert.equal(second?.label, "Add experience");
    const none = pickScreenAction(buttons, [first!.fingerprint, second!.fingerprint]);
    assert.equal(none, null);
    assert.equal(pickScreenActions(buttons, [], 2).length, 2);
  });

  it("treats job-listing copy as work the loop should open", () => {
    assert.equal(looksLikeJobListingCopy("Job description\nAbout the role\nApply now"), true);
    assert.equal(looksLikeJobListingCopy("Privacy policy"), false);
  });
});
