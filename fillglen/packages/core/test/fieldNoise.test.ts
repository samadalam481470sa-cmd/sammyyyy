import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAutofillBatch,
  fillMatchedIntent,
  filterRealQuestions,
  isNoiseFieldLabel,
  isRealQuestion,
  rankFillPlans,
  shouldAutofillPlan,
  shouldScanControl,
} from "../src/index.js";
import { planFill } from "../src/resolve.js";
import { EMPTY_PROFILE, hydrateProfile, type FillPlan, type Question } from "../src/types.js";

function q(partial: Partial<Question> & Pick<Question, "label" | "type">): Question {
  return {
    id: partial.id || "1",
    required: false,
    kind: "text",
    value: "",
    source: "none",
    status: "needs-you",
    confidence: "high",
    position: 0,
    ...partial,
  };
}

describe("fieldNoise", () => {
  it("hides progress scrubbers and unlabeled chrome", () => {
    assert.equal(isNoiseFieldLabel("Progress scrubber"), true);
    assert.equal(isNoiseFieldLabel("(unlabeled field)"), true);
    assert.equal(isNoiseFieldLabel("General"), true);
    assert.equal(isNoiseFieldLabel("GeneralInformationDocumentationComments"), true);
    assert.equal(isNoiseFieldLabel("0"), true);
    assert.equal(isNoiseFieldLabel("Country"), false);
    assert.equal(isNoiseFieldLabel("Zip Code"), false);
  });

  it("filters junk out of scanned question lists", () => {
    const kept = filterRealQuestions([
      q({ id: "a", label: "Progress scrubber", type: "unknown", kind: "text", value: "0" }),
      q({ id: "b", label: "(unlabeled field)", type: "unknown", kind: "text", value: "General" }),
      q({ id: "c", label: "Country", type: "country", required: true }),
      q({ id: "d", label: "Email", type: "email", required: true }),
    ]);
    assert.deepEqual(
      kept.map((x) => x.id),
      ["c", "d"]
    );
  });

  it("skips range/slider controls during scan", () => {
    assert.equal(shouldScanControl({ tag: "input", type: "range" }), false);
    assert.equal(shouldScanControl({ tag: "div", role: "slider" }), false);
    assert.equal(shouldScanControl({ tag: "div", role: "progressbar" }), false);
    assert.equal(shouldScanControl({ tag: "input", type: "text" }), true);
    assert.equal(shouldScanControl({ tag: "div", role: "combobox" }), true);
  });

  it("gates autofill away from optional unknowns", () => {
    const plan: FillPlan = {
      questionId: "1",
      value: "x",
      source: "profile",
      status: "filled",
      confidence: "check-this",
      type: "unknown",
    };
    assert.equal(shouldAutofillPlan(plan, q({ label: "mystery", type: "unknown" })), false);
    assert.equal(
      shouldAutofillPlan(
        { ...plan, type: "email", confidence: "high" },
        q({ label: "Email", type: "email", required: true })
      ),
      true
    );
  });

  it("ranks required contact fields ahead of soft drafts", () => {
    const questions = [
      q({ id: "m", label: "Why us?", type: "motivation", required: false }),
      q({ id: "e", label: "Email", type: "email", required: true }),
      q({ id: "z", label: "Zip", type: "zip", required: true }),
    ];
    const profile = hydrateProfile({
      ...EMPTY_PROFILE,
      contact: { ...EMPTY_PROFILE.contact, email: "a@b.com", zip: "75006" },
    });
    const plans = questions.map((question) => planFill(question, profile));
    const ranked = rankFillPlans(plans, questions);
    assert.equal(ranked[0].questionId, "e");
  });

  it("buildAutofillBatch drops noise and caps the tick", () => {
    const profile = hydrateProfile({
      ...EMPTY_PROFILE,
      contact: {
        ...EMPTY_PROFILE.contact,
        email: "sam@example.com",
        phone: "2145550100",
        zip: "75006",
        country: "United States",
      },
    });
    const { realQuestions, ready, remainder } = buildAutofillBatch(
      [
        q({ id: "noise", label: "Progress scrubber", type: "unknown", value: "0" }),
        q({ id: "e", label: "Email", type: "email", required: true }),
        q({ id: "p", label: "Phone", type: "phone", required: true }),
        q({ id: "z", label: "Zip", type: "zip", required: true }),
      ],
      profile,
      2
    );
    assert.equal(realQuestions.some((x) => x.label === "Progress scrubber"), false);
    assert.equal(ready.length, 2);
    assert.equal(remainder, 1);
    assert.equal(ready[0].plan.type, "email");
  });

  it("fillMatchedIntent tolerates shortened option labels", () => {
    assert.equal(fillMatchedIntent("United States of America", "United States", "select"), true);
    assert.equal(fillMatchedIntent("Male", "Female", "select"), false);
    assert.equal(isRealQuestion(q({ label: "Email", type: "email" })), true);
  });
});
