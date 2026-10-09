import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analysisIsFresh,
  analysisSummary,
  analyzeApplyPage,
  fillBudgetForAnalysis,
  fillProgressDetail,
} from "../src/pageAnalyze.js";

describe("pageAnalyze", () => {
  it("waits on a CAPTCHA instead of filling", () => {
    const a = analyzeApplyPage({
      url: "https://company.myworkdayjobs.com/en-US/job/apply",
      bodyText: "Please verify you are human to continue.",
      captcha: true,
      visibleFieldCount: 4,
    });
    assert.equal(a.stage, "captcha");
    assert.equal(a.action, "wait");
    assert.equal(a.ready, false);
  });

  it("opens Apply on a listing before touching fields", () => {
    const a = analyzeApplyPage({
      url: "https://jobs.example.com/careers/swe",
      bodyText: "About this role. Job description. Qualifications. Apply now.",
      visibleFieldCount: 0,
      hasApplyCta: true,
    });
    assert.equal(a.stage, "listing");
    assert.equal(a.action, "open-apply");
  });

  it("chooses auth on a sign-in wall", () => {
    const a = analyzeApplyPage({
      url: "https://company.myworkdayjobs.com/login",
      bodyText: "Create an account or sign in to continue. Forgot password.",
      hasPassword: true,
      authButtonCount: 2,
      visibleFieldCount: 2,
    });
    assert.equal(a.action, "auth");
    assert.equal(a.stage, "auth");
  });

  it("fills a simple form quickly with a larger budget", () => {
    const a = analyzeApplyPage({
      url: "https://boards.greenhouse.io/acme/jobs/1/application",
      bodyText: "First name. Email. Submit application.",
      visibleFieldCount: 5,
      requiredEmpty: 3,
      filledCount: 0,
    });
    assert.equal(a.action, "fill");
    assert.ok(fillBudgetForAnalysis(a) >= 6);
    assert.ok(a.reasons.includes("simple-form"));
  });

  it("submits only after required fields are done", () => {
    const a = analyzeApplyPage({
      url: "https://jobs.lever.co/acme/abc/apply",
      bodyText: "Review your application. Ready to submit.",
      visibleFieldCount: 8,
      requiredEmpty: 0,
      filledCount: 8,
      hasSubmit: true,
    });
    assert.equal(a.action, "submit");
  });

  it("hands off on a confirmation page", () => {
    const a = analyzeApplyPage({
      url: "https://jobs.lever.co/acme/abc/thanks",
      bodyText: "Thank you for applying. We have received your application.",
      visibleFieldCount: 0,
    });
    assert.equal(a.action, "handoff");
    assert.equal(a.stage, "submitted");
  });

  it("blocks LinkedIn Easy Apply", () => {
    const a = analyzeApplyPage({
      url: "https://www.linkedin.com/jobs/view/1/",
      bodyText: "Easy Apply",
      visibleFieldCount: 3,
    });
    assert.equal(a.action, "skip");
    assert.equal(a.stage, "blocked");
  });

  it("reads a random host form then fills instead of skipping", () => {
    const a = analyzeApplyPage({
      url: "https://jobs.acme-corp.example/apply",
      bodyText:
        "First Name Last Name Email Phone Country Phone Location Resume Education Submit application",
      visibleFieldCount: 45,
      hasFileInput: true,
      requiredEmpty: 40,
      filledCount: 0,
    });
    assert.equal(a.action, "fill");
    assert.equal(a.stage, "form");
    assert.ok(a.reasons.includes("read-page-then-fill"));
    assert.ok(a.reasons.includes("long-form"));
    assert.match(analysisSummary(a), /form → fill/);
    assert.match(fillProgressDetail(45, 12), /45 fields detected/);
    assert.match(fillProgressDetail(0, 0), /Detecting questions/);
  });

  it("fills a long form even when the host is unknown", () => {
    const a = analyzeApplyPage({
      url: "https://portal.random-corp.example/form/step2",
      bodyText: "",
      visibleFieldCount: 18,
    });
    assert.equal(a.action, "fill");
    assert.ok(a.reasons.includes("read-page-then-fill"));
  });

  it("does not treat a checkout or comment form as an application", () => {
    const a = analyzeApplyPage({
      url: "https://shop.example.com/checkout",
      bodyText: "First name Last name Email Phone Zip Place order",
      visibleFieldCount: 6,
    });
    assert.equal(a.action, "skip");
    assert.equal(a.stage, "unknown");
  });

  it("reuses a fingerprint when the page has not changed", () => {
    const facts = {
      url: "https://boards.greenhouse.io/acme/jobs/1",
      bodyText: "First name",
      visibleFieldCount: 2,
    };
    const a = analyzeApplyPage(facts);
    assert.equal(analysisIsFresh(a, facts), true);
    assert.equal(analysisIsFresh(a, { ...facts, visibleFieldCount: 9 }), false);
    assert.match(analysisSummary(a), /form → fill/);
  });
});
