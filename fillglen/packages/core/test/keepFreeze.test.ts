import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KEEP_BUSY_WATCHDOG_MS,
  KEEP_SCAN_FILL_LIMIT,
  bumpCycle,
  cooldownAfterTick,
  isStaleCycle,
  keepBusyExpired,
  mayRestoreFieldWrite,
  scanMayAutofill,
  shouldRetryResume,
  shouldScanNow,
  skipFilledThisStep,
  takeTickBatch,
} from "../src/index.js";
import type { ReadyFill } from "../src/fillPipeline.js";
import type { Question } from "../src/types.js";

function q(partial: Partial<Question> & Pick<Question, "id" | "kind" | "type">): Question {
  return {
    label: partial.label || partial.id,
    required: false,
    value: "",
    source: "none",
    status: "needs-you",
    confidence: "high",
    frameId: "top",
    position: 0,
    ...partial,
  };
}

function ready(id: string, kind: Question["kind"], type: Question["type"]): ReadyFill {
  const question = q({ id, kind, type, label: id });
  return {
    question,
    plan: { questionId: id, value: "x", type, source: "profile", confidence: "high", status: "filled" },
  };
}

describe("keepFreeze", () => {
  it("never lets a full scan autofill a page of fields", () => {
    assert.equal(KEEP_SCAN_FILL_LIMIT, 0);
    assert.equal(scanMayAutofill(40), 0);
    assert.equal(scanMayAutofill(0), 0);
  });

  it("throttles scans and resume attach so mutations do not re-enter", () => {
    assert.equal(shouldScanNow(0, 1800, 1000), true);
    assert.equal(shouldScanNow(1000, 1800, 2000), false);
    assert.equal(shouldScanNow(1000, 1800, 3000), true);
    assert.equal(shouldRetryResume(0, false, 10), true);
    assert.equal(shouldRetryResume(10, true, 9000), false);
    assert.equal(shouldRetryResume(10, false, 9000), true);
  });

  it("aborts an overlapping keep cycle instead of stacking fills", () => {
    const first = 1;
    const next = bumpCycle(first);
    assert.equal(isStaleCycle(first, next), true);
    assert.equal(isStaleCycle(next, next), false);
    assert.equal(keepBusyExpired(1_000, 1_000 + 3000), false);
    assert.equal(keepBusyExpired(1_000, 1_000 + KEEP_BUSY_WATCHDOG_MS), true);
  });

  it("skips fields already verified this step even when the ATS clears the input", () => {
    assert.equal(skipFilledThisStep("gender", ["gender"], "", "select"), true);
    assert.equal(skipFilledThisStep("gender", ["gender"], "Male", "select"), true);
    assert.equal(skipFilledThisStep("email", [], "", "text"), false);
  });

  it("opens at most one dropdown per tick then yields", () => {
    const batch = takeTickBatch(
      [
        ready("country", "select", "country"),
        ready("gender", "select", "gender"),
        ready("email", "text", "email"),
      ],
      3
    );
    assert.equal(batch.length, 1);
    assert.equal(batch[0].question.id, "country");
    const texts = takeTickBatch(
      [ready("email", "text", "email"), ready("phone", "text", "phone"), ready("city", "text", "city")],
      2
    );
    assert.equal(texts.length, 2);
    assert.deepEqual(
      texts.map((r) => r.question.id),
      ["email", "phone"]
    );
    const mixed = takeTickBatch(
      [ready("email", "text", "email"), ready("gender", "select", "gender")],
      3
    );
    assert.deepEqual(
      mixed.map((r) => r.question.id),
      ["email"]
    );
  });

  it("cools down longer after a fill so React can paint", () => {
    assert.ok(cooldownAfterTick(1, true) > cooldownAfterTick(1, false));
    assert.ok(cooldownAfterTick(1, false) > cooldownAfterTick(0, false));
  });

  it("restores only a few text fields once — never dropdowns on every scan", () => {
    assert.equal(
      mayRestoreFieldWrite(false, 0, { kind: "text", type: "email", value: "a@b.com" }, ""),
      true
    );
    assert.equal(
      mayRestoreFieldWrite(true, 0, { kind: "text", type: "email", value: "a@b.com" }, ""),
      false
    );
    assert.equal(
      mayRestoreFieldWrite(false, 0, { kind: "select", type: "gender", value: "Male" }, ""),
      false
    );
    assert.equal(
      mayRestoreFieldWrite(false, 4, { kind: "text", type: "email", value: "a@b.com" }, ""),
      false
    );
  });
});
