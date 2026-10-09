import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cycleOverBudget,
  keepBusyExpired,
  looksLikeConfirmationUrl,
  mayHandoffToNextJob,
  stuckMeansStay,
  submitWaitElapsed,
  KEEP_CYCLE_BUDGET_MS,
} from "../src/handoffGuard.js";

describe("handoffGuard", () => {
  it("does not start the next job when the current one is only stuck", () => {
    const gate = mayHandoffToNextJob({ reason: "stuck", evidence: { clickedSubmit: false } });
    assert.equal(gate.ok, false);
    assert.equal(stuckMeansStay(), true);
  });

  it("requires submit evidence before leaving", () => {
    assert.equal(mayHandoffToNextJob({ reason: "submitted" }).ok, false);
    assert.equal(
      mayHandoffToNextJob({
        reason: "submitted",
        evidence: { clickedSubmit: true, confirmationPage: true },
      }).ok,
      true
    );
    assert.equal(
      mayHandoffToNextJob({
        reason: "submitted",
        evidence: { confirmationUrl: true },
      }).ok,
      true
    );
  });

  it("reads confirmation URLs, not job-description copy", () => {
    assert.equal(looksLikeConfirmationUrl("https://jobs.example.com/thanks"), true);
    assert.equal(looksLikeConfirmationUrl("https://boards.greenhouse.io/acme/jobs/1/confirmation"), true);
    assert.equal(looksLikeConfirmationUrl("https://boards.greenhouse.io/acme/jobs/1"), false);
  });

  it("yields a keep cycle before the tab freezes", () => {
    const start = 1_000_000;
    assert.equal(cycleOverBudget(start, start + KEEP_CYCLE_BUDGET_MS), true);
    assert.equal(cycleOverBudget(start, start + 100), false);
    assert.equal(keepBusyExpired(start, start + 3000), true);
    assert.equal(submitWaitElapsed(start, start + 700), true);
  });

  it("lets a blocked LinkedIn page leave so the queue does not stall", () => {
    assert.equal(mayHandoffToNextJob({ reason: "blocked" }).ok, true);
  });
});
