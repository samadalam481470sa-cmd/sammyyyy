import rules from "../data/matching-rules.json" with { type: "json" };
import { normalize } from "./fuzzy.js";

export function isFinalSubmitLabel(label: string): boolean {
  const n = normalize(label);
  if (!n) return false;
  if (rules.finalSubmitPatterns.some((p) => n === normalize(p) || n.includes(normalize(p)))) return true;
  if (n === "submit" || n === "apply" || n === "apply now") return true;
  return false;
}

export function isStepAdvanceLabel(label: string): boolean {
  const n = normalize(label);
  return rules.stepAdvancePatterns.some((p) => n === normalize(p));
}

/** Fillglen never clicks the last Submit. Step buttons stay with the user too unless an adapter opts in. */
export function mayAutoClick(label: string): boolean {
  return !isFinalSubmitLabel(label);
}
