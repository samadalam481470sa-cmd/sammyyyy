import { fieldLooksFilled } from "./answers.js";
import { filterRealQuestions, rankFillPlans, shouldAutofillPlan } from "./fieldNoise.js";
import { planFill } from "./resolve.js";
import type { FillPlan, Profile, Question } from "./types.js";

export interface ReadyFill {
  plan: FillPlan;
  question: Question;
}

/**
 * Multi-layer autofill pipeline:
 * 1) drop chrome noise (progress scrubbers, tab strips, unlabeled junk)
 * 2) resolve profile/saved answers per field
 * 3) gate low-confidence / optional unknowns
 * 4) rank required + known types first for smoother ticks
 */
export function buildAutofillBatch(
  questions: Question[],
  profile: Profile,
  limit: number,
  skipIds: Iterable<string> = []
): { realQuestions: Question[]; ready: ReadyFill[]; remainder: number } {
  const skip = new Set(skipIds);
  const realQuestions = filterRealQuestions(questions);
  const byId = new Map(realQuestions.map((q) => [q.id, q]));
  const plans = rankFillPlans(
    realQuestions
      .map((q) => planFill(q, profile))
      .filter((p) => {
        if (skip.has(p.questionId)) return false;
        const q = byId.get(p.questionId);
        if (!shouldAutofillPlan(p, q)) return false;
        if (q && fieldLooksFilled(q.kind, q.value)) return false;
        return true;
      }),
    realQuestions
  );
  const ready: ReadyFill[] = [];
  for (const plan of plans) {
    const question = byId.get(plan.questionId);
    if (!question) continue;
    ready.push({ plan, question });
    if (ready.length >= limit) break;
  }
  return { realQuestions, ready, remainder: Math.max(0, plans.length - ready.length) };
}

/** True when the live DOM value matches what we intended to inject. */
export function fillMatchedIntent(intent: string, readBack: string, kind: Question["kind"]): boolean {
  if (!fieldLooksFilled(kind, readBack)) return false;
  const a = intent.trim().toLowerCase();
  const b = readBack.trim().toLowerCase();
  if (!a || !b) return Boolean(b);
  if (a === b) return true;
  // Whole-phrase containment only — avoid "male" ⊆ "female".
  if (a.length >= 4 && (` ${b} `.includes(` ${a} `) || b.startsWith(a + " ") || b.endsWith(" " + a))) return true;
  if (b.length >= 4 && (` ${a} `.includes(` ${b} `) || a.startsWith(b + " ") || a.endsWith(" " + b))) return true;
  // Option labels often shorten ("United States of America" → "United States").
  const at = a.split(/\s+/).filter((t) => t.length > 2);
  const bt = new Set(b.split(/\s+/).filter((t) => t.length > 2));
  if (at.length >= 2 && at.filter((t) => bt.has(t)).length / at.length >= 0.5) return true;
  return false;
}
