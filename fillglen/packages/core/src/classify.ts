import rules from "../data/matching-rules.json" with { type: "json" };
import { bestSavedMatch, normalize } from "./fuzzy.js";
import type { Profile, QuestionType, SavedAnswer } from "./types.js";

export interface ClassifyInput {
  label: string;
  name?: string;
  placeholder?: string;
  inputType?: string;
  autocomplete?: string;
}

export interface ClassifyResult {
  type: QuestionType;
  via: "input-type" | "rule" | "saved" | "unknown";
}

const SELF_ID = new Set<string>(rules.selfIdTypes);
const NEVER_AI = new Set<string>(rules.neverAiTypes);

export function isSelfId(type: QuestionType): boolean {
  return SELF_ID.has(type);
}

export function neverSendToAi(type: QuestionType): boolean {
  return NEVER_AI.has(type);
}

function blob(input: ClassifyInput): string {
  return [input.label, input.name, input.placeholder, input.autocomplete].filter(Boolean).join(" ");
}

function hasPhrase(text: string, phrase: string): boolean {
  return ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);
}

export function classifyQuestion(input: ClassifyInput, saved: SavedAnswer[] = []): ClassifyResult {
  const t = (input.inputType || "").toLowerCase();
  if (t === "email") return { type: "email", via: "input-type" };
  if (t === "tel") return { type: "phone", via: "input-type" };
  if (t === "url" && /linkedin/i.test(blob(input))) return { type: "linkedin", via: "input-type" };
  if (t === "file") {
    const b = blob(input);
    if (/cover/i.test(b)) return { type: "coverLetter", via: "rule" };
    return { type: "resume", via: "rule" };
  }

  const text = blob(input);
  for (const field of rules.fields) {
    if (field.patterns.some((p) => hasPhrase(text, p))) {
      return { type: field.type as QuestionType, via: "rule" };
    }
  }

  const hit = bestSavedMatch(input.label, saved);
  if (hit) return { type: "factual", via: "saved" };

  return { type: "unknown", via: "unknown" };
}

export function classifyAiBucket(type: QuestionType): "profile-only" | "draft" | "never" | "needs-you" {
  if (neverSendToAi(type)) return "never";
  if (type === "motivation" || type === "behavioral" || type === "coverLetter") return "draft";
  if (type === "unknown") return "needs-you";
  return "profile-only";
}

export function profileHasFacts(profile: Profile): boolean {
  return Boolean(profile.contact.email || profile.contact.legalName || profile.rawResumeText);
}
