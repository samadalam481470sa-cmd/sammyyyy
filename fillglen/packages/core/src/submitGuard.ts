import rules from "../data/matching-rules.json" with { type: "json" };
import { normalize } from "./fuzzy.js";

export function isFinalSubmitLabel(label: string): boolean {
  const n = normalize(label);
  if (!n) return false;
  if (rules.finalSubmitPatterns.some((p) => n === normalize(p) || n.includes(normalize(p)))) return true;
  if (n === "submit") return true;
  return false;
}

export function isStepAdvanceLabel(label: string): boolean {
  const n = normalize(label);
  return rules.stepAdvancePatterns.some((p) => n === normalize(p));
}

/**
 * Next/Continue is allowed during fill. Final Submit is only allowed in keep-applying
 * mode after the user hits Autofill (screen-on loop). LinkedIn is still blocked elsewhere.
 */
export function mayAutoClick(label: string, mode: "fill-only" | "keep-applying" = "fill-only"): boolean {
  if (isFinalSubmitLabel(label)) return mode === "keep-applying";
  return true;
}
