import { classifyAdvanceLabel } from "./applyLoop.js";
import { classifyAuthGate } from "./authGate.js";
import { normalize } from "./fuzzy.js";
import { isGoogleSignInLabel } from "./answers.js";

export type FillPace = "fast" | "slow";
export type ScreenKind = "act" | "never";

export const KEEP_FAST_INTERVAL_MS = 240;
export const KEEP_SLOW_INTERVAL_MS = 720;
export const KEEP_SLOW_GAP_MS = 120;
export const KEEP_SLOW_CHAR_MS = 28;
export const SCREEN_CLICK_BUDGET = 2;
export const SCREEN_SKIP_MAX = 48;

const DETECTED =
  /unusual activity|automated (traffic|browser|behavior)|bot detected|please (slow down|try again)|access denied|temporarily blocked|too many requests|rate limit|suspicious (activity|behavior)|attention required|just a moment|checking your browser|enable javascript|verify (you are|it's you)|we detected|not a robot|security check/;

/** Never click these — money, logout, LinkedIn Easy Apply, destructive. */
const NEVER =
  /log ?out|sign ?out|delete (my )?account|close account|withdraw( application)?|cancel application|not interested|skip (this )?(company|job)|unsubscribe|report (job|user)|block (user|company)|unfollow|easy apply|share (on|via)|tweet|facebook|instagram|pinterest|delete resume|remove account|disable (keep|autofill)|donate|buy now|add to cart|pay now|credit card|checkout|place order|delete (job|listing)|trash|uninstall|remove (my )?(profile|resume)|deactivate/;

/**
 * Safe on-screen helpers that unblock the form. Auth gates (sign up / last
 * application) and Next/Submit are handled elsewhere so this cannot pick the
 * wrong company path or fire Submit early.
 */
const ACT =
  /accept( all)?( cookies)?|agree to (all )?(cookies|terms)|i agree|got it|okay|^ok$|save$|add (another|education|experience|job|school|skill|language|certification)|upload( resume| cv)$|attach( resume| cv)$|use this resume|replace resume|allow( all)? cookies|dismiss|close (this )?(dialog|banner|popup|modal)|confirm( location)?|look up|not applicable|^n\/a$|no middle name|i don't have (a |one )?middle|skip (for now|this question)|necessary cookies|i understand|enable cookies|done adding|finish later|current (role|position)|i am currently employed|still work here/;

const OS_FILE_PICKER = /^(choose file|select file|browse|browse files|browse…|browse\.\.\.)$/;

export function pageLooksDetected(text: string): boolean {
  return DETECTED.test(normalize(text));
}

export function fillPaceForPage(text: string): FillPace {
  return pageLooksDetected(text) ? "slow" : "fast";
}

export function classifyWorkdayAutomation(id: string): ScreenKind | null {
  const n = normalize(id);
  if (!n) return null;
  if (/signout|logout|withdraw|cancelButton|closeAccount|deleteAccount|easyApply/.test(n)) return "never";
  if (/fileuploadInput|dropzone|cookie|consent|addanother|addeducation|addexperience|addskill/.test(n)) {
    return "act";
  }
  return null;
}

export function classifyScreenControl(label: string, automationId = ""): ScreenKind | null {
  const n = normalize(label);
  const auto = classifyWorkdayAutomation(automationId);
  if (auto === "never") return "never";
  if (NEVER.test(n)) return "never";
  if (!n || n.length > 96) return auto;
  if (classifyAuthGate(n) || classifyAdvanceLabel(n) || isGoogleSignInLabel(n) || OS_FILE_PICKER.test(n)) {
    return null;
  }
  if (ACT.test(n)) return "act";
  return auto;
}

export function controlFingerprint(label: string, automationId = ""): string {
  return `${normalize(label)}|${normalize(automationId)}`;
}

export function pickScreenAction(
  buttons: { label: string; automationId?: string }[],
  skip: string[] = []
): { label: string; kind: "act"; fingerprint: string } | null {
  const skipped = new Set(skip);
  for (const b of buttons) {
    if (classifyScreenControl(b.label, b.automationId) !== "act") continue;
    const fingerprint = controlFingerprint(b.label, b.automationId);
    if (skipped.has(fingerprint)) continue;
    return { label: b.label, kind: "act", fingerprint };
  }
  return null;
}

export function pickScreenActions(
  buttons: { label: string; automationId?: string }[],
  skip: string[] = [],
  budget = SCREEN_CLICK_BUDGET
): { label: string; kind: "act"; fingerprint: string }[] {
  const out: { label: string; kind: "act"; fingerprint: string }[] = [];
  const skipped = [...skip];
  for (let i = 0; i < budget; i++) {
    const next = pickScreenAction(buttons, skipped);
    if (!next) break;
    out.push(next);
    skipped.push(next.fingerprint);
  }
  return out;
}

export function trimScreenSkip(skip: string[], max = SCREEN_SKIP_MAX): string[] {
  return skip.length > max ? skip.slice(-Math.floor(max * 0.75)) : skip;
}

export function looksLikeJobListingCopy(text: string): boolean {
  const n = normalize(text);
  return /job description|about (the|this) role|what you'll do|what you will do|apply now|we're hiring|we are hiring|qualifications|responsibilities/.test(
    n
  );
}

/** Listing pages with an Apply control should run keep-applying, not sit idle. */
export function pageIsKeepWork(
  text: string,
  extras?: { hasAuth?: boolean; hasFile?: boolean; hasPassword?: boolean }
): boolean {
  if (extras?.hasAuth || extras?.hasFile || extras?.hasPassword) return true;
  return looksLikeJobListingCopy(text) && /apply( now)?|start application|submit application/.test(normalize(text));
}
