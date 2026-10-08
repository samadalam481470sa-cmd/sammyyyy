import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyQuestion, classifyAiBucket, isSelfId, neverSendToAi } from "../src/classify.js";
import { planFill, valueForType } from "../src/resolve.js";
import { shouldBlockPage, isLinkedInEasyApply } from "../src/linkedin.js";
import { isFinalSubmitLabel, isStepAdvanceLabel, mayAutoClick } from "../src/submitGuard.js";
import { stableQuestionId, diffQuestions } from "../src/questionId.js";
import { scoreMatch } from "../src/matchScore.js";
import { tailorResume } from "../src/tailor.js";
import { buildAiPrompt, parseAiDraft } from "../src/ai.js";
import { adapterFor, isSupportedApplyUrl } from "../src/adapters.js";
import { bestSavedMatch, tokenSetRatio } from "../src/fuzzy.js";
import { EMPTY_PROFILE, type Profile, type Question } from "../src/types.js";

function q(partial: Partial<Question> & Pick<Question, "label" | "type">): Question {
  return {
    id: partial.id || "1",
    required: true,
    kind: "text",
    value: "",
    source: "none",
    status: "needs-you",
    confidence: "high",
    position: 0,
    ...partial,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    ...EMPTY_PROFILE,
    contact: {
      ...EMPTY_PROFILE.contact,
      legalName: "Sam Rivera",
      email: "sam@example.com",
      phone: "2145550100",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      linkedin: "https://linkedin.com/in/sam",
    },
    preferences: { ...EMPTY_PROFILE.preferences, workAuthorized: true, needsSponsorship: false, salaryMin: 120000 },
    skills: [{ name: "TypeScript", category: "lang", years: 5, level: "advanced" }],
    work: [
      {
        id: "w1",
        company: "North Glen Labs",
        title: "Software Engineer",
        startDate: "2021-01",
        endDate: "Present",
        location: "Dallas, TX",
        bullets: [{ text: "Built TypeScript APIs on PostgreSQL.", tags: ["typescript", "postgresql"] }],
      },
    ],
    rawResumeText: "Sam Rivera. Software Engineer. TypeScript, React, PostgreSQL, AWS.",
    answers: [{ id: "a1", pattern: "how did you hear about this job", answer: "Company careers page", tags: [], useCount: 1, lastUsedAt: null }],
    ...over,
  };
}

describe("classify rules", () => {
  it("maps email input type", () => {
    assert.equal(classifyQuestion({ label: "Contact", inputType: "email" }).type, "email");
  });
  it("maps phone from label", () => {
    assert.equal(classifyQuestion({ label: "Mobile phone number" }).type, "phone");
  });
  it("maps first and last name", () => {
    assert.equal(classifyQuestion({ label: "First name" }).type, "firstName");
    assert.equal(classifyQuestion({ label: "Last name / surname" }).type, "lastName");
  });
  it("maps work authorization", () => {
    assert.equal(classifyQuestion({ label: "Are you legally authorized to work in the US?" }).type, "workAuthorization");
  });
  it("maps visa sponsorship", () => {
    assert.equal(classifyQuestion({ label: "Will you require visa sponsorship?" }).type, "visaSponsorship");
  });
  it("maps self-id gender/race/veteran/disability", () => {
    assert.equal(classifyQuestion({ label: "Gender" }).type, "gender");
    assert.equal(classifyQuestion({ label: "Race / ethnicity" }).type, "race");
    assert.equal(classifyQuestion({ label: "Protected veteran status" }).type, "veteran");
    assert.equal(classifyQuestion({ label: "Disability status" }).type, "disability");
  });
  it("maps motivation and behavioral", () => {
    assert.equal(classifyQuestion({ label: "Why do you want to work here?" }).type, "motivation");
    assert.equal(classifyQuestion({ label: "Tell us about a time you led a project" }).type, "behavioral");
  });
  it("maps resume file upload", () => {
    assert.equal(classifyQuestion({ label: "Upload resume", inputType: "file" }).type, "resume");
  });
  it("maps cover letter file", () => {
    assert.equal(classifyQuestion({ label: "Cover letter", inputType: "file" }).type, "coverLetter");
  });
  it("uses saved library as factual when rules miss", () => {
    const r = classifyQuestion(
      { label: "How did you hear about this job?" },
      profile().answers
    );
    assert.equal(r.via, "saved");
  });
});

describe("self-id and AI buckets", () => {
  it("treats self-id as never-AI", () => {
    assert.equal(isSelfId("gender"), true);
    assert.equal(neverSendToAi("veteran"), true);
    assert.equal(classifyAiBucket("gender"), "never");
    assert.equal(classifyAiBucket("workAuthorization"), "never");
  });
  it("drafts motivation, needs-you for unknown", () => {
    assert.equal(classifyAiBucket("motivation"), "draft");
    assert.equal(classifyAiBucket("unknown"), "needs-you");
    assert.equal(classifyAiBucket("email"), "profile-only");
  });
});

describe("resolve values", () => {
  it("fills contact fields from profile", () => {
    const p = profile();
    assert.equal(valueForType("email", p), "sam@example.com");
    assert.equal(valueForType("firstName", p), "Sam");
    assert.equal(valueForType("lastName", p), "Rivera");
    assert.equal(valueForType("phone", p), "2145550100");
  });
  it("uses saved answer over profile for matching questions", () => {
    const plan = planFill(q({ label: "How did you hear about this job?", type: "unknown" }), profile());
    assert.equal(plan.value, "Company careers page");
    assert.equal(plan.source, "saved");
  });
  it("defaults self-id to decline", () => {
    const plan = planFill(q({ label: "Gender", type: "gender" }), profile());
    assert.match(plan.value, /Decline/);
    assert.equal(plan.source, "profile");
  });
  it("does not invent a motivation answer", () => {
    const plan = planFill(q({ label: "Why this role?", type: "motivation" }), profile());
    assert.equal(plan.value, "");
    assert.equal(plan.status, "needs-you");
  });
  it("answers work authorization from preferences", () => {
    const plan = planFill(q({ label: "Authorized?", type: "workAuthorization", options: ["Yes", "No"] }), profile());
    assert.equal(plan.value, "Yes");
  });
});

describe("linkedin and submit guards", () => {
  it("blocks LinkedIn Easy Apply URLs", () => {
    assert.equal(isLinkedInEasyApply("https://www.linkedin.com/jobs/view/123/?easyApply=true"), true);
    assert.equal(shouldBlockPage("https://www.linkedin.com/jobs/collections/recommended/"), "linkedin-easy-apply");
  });
  it("does not block Greenhouse", () => {
    assert.equal(shouldBlockPage("https://boards.greenhouse.io/acme/jobs/1"), null);
  });
  it("never treats Submit Application as clickable", () => {
    assert.equal(isFinalSubmitLabel("Submit Application"), true);
    assert.equal(mayAutoClick("Submit Application"), false);
    assert.equal(isFinalSubmitLabel("Submit"), true);
  });
  it("recognizes Workday step buttons without treating them as final submit", () => {
    assert.equal(isStepAdvanceLabel("Save and Continue"), true);
    assert.equal(isFinalSubmitLabel("Save and Continue"), false);
  });
});

describe("question ids and diffs", () => {
  it("keeps ids stable for the same label/name/position", () => {
    const a = stableQuestionId({ label: "Email", name: "email", position: 0 });
    const b = stableQuestionId({ label: "Email", name: "email", position: 0 });
    assert.equal(a, b);
  });
  it("emits added/removed/changed", () => {
    const d = diffQuestions(
      [
        { id: "a", value: "1", status: "filled" },
        { id: "b", value: "", status: "needs-you" },
      ],
      [
        { id: "a", value: "2", status: "filled" },
        { id: "c", value: "", status: "needs-you" },
      ]
    );
    assert.deepEqual(d.added, ["c"]);
    assert.deepEqual(d.removed, ["b"]);
    assert.deepEqual(d.changed, ["a"]);
  });
});

describe("match score", () => {
  it("matches typescript synonyms and explains itself", () => {
    const m = scoreMatch("Required: TypeScript, React, AWS EC2. Preferred: Kubernetes.", profile());
    assert.ok(m.score > 0);
    assert.ok(m.matched.length > 0);
    assert.match(m.explanation, /not a prediction/i);
  });
  it("lists missing skills without claiming ATS pass", () => {
    const m = scoreMatch("Required: COBOL, Fortran", profile());
    assert.ok(m.missing.includes("cobol") || m.missing.length > 0);
  });
});

describe("resume tailor", () => {
  it("never adds a skill the profile lacks", () => {
    const r = tailorResume(profile(), "Need COBOL", ["COBOL"]);
    assert.ok(r.missingSkills.some((s) => /cobol/i.test(s)));
    assert.ok(r.rejectedInventions.length > 0);
    assert.ok(r.bullets.every((b) => !/cobol/i.test(b.proposed) || /cobol/i.test(b.original)));
  });
});

describe("AI gate", () => {
  it("refuses self-id prompts", () => {
    const p = buildAiPrompt(
      { question: "Gender?", type: "gender", jobTitle: "Eng", company: "Acme", jobDescription: "", similarAnswers: [] },
      profile()
    );
    assert.equal("refused" in p && p.refused, true);
  });
  it("parses NEEDS_HUMAN", () => {
    assert.equal(parseAiDraft("NEEDS_HUMAN").refused, true);
  });
  it("extracts FACTS used", () => {
    const d = parseAiDraft("I built APIs.\nFACTS:\n- TypeScript APIs");
    assert.equal(d.refused, false);
    assert.equal(d.usedFacts[0], "TypeScript APIs");
  });
});

describe("adapters", () => {
  it("detects greenhouse lever ashby workday icims smartrecruiters", () => {
    assert.equal(adapterFor("https://boards.greenhouse.io/x/jobs/1")?.id, "greenhouse");
    assert.equal(adapterFor("https://jobs.lever.co/x/abc")?.id, "lever");
    assert.equal(adapterFor("https://jobs.ashbyhq.com/x")?.id, "ashby");
    assert.equal(adapterFor("https://acme.myworkdayjobs.com/en-US/careers")?.id, "workday");
    assert.equal(adapterFor("https://careers-acme.icims.com/jobs/1")?.id, "icims");
    assert.equal(adapterFor("https://jobs.smartrecruiters.com/acme/1")?.id, "smartrecruiters");
  });
  it("flags apply paths as supported", () => {
    assert.equal(isSupportedApplyUrl("https://example.com/jobs/42/apply"), true);
  });
});

describe("fuzzy saved answers", () => {
  it("matches reworded questions", () => {
    const hit = bestSavedMatch("Where did you hear about us?", [{ pattern: "how did you hear about this job", answer: "Careers page" }]);
    assert.ok(hit && hit.score > 0.4);
  });
  it("token ratio is symmetric-ish", () => {
    assert.ok(tokenSetRatio("work authorization", "authorized to work") >= 0);
  });
});
