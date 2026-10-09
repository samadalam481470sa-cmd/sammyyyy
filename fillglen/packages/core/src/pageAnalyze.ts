import { KEEP_FIELDS_PER_TICK, pageLooksLikeCaptcha } from "./applyLoop.js";
import { looksLikeApplicationPage, atsHostOf } from "./ats.js";
import { looksLikeAuthWall } from "./authGate.js";
import { isLinkedInHost } from "./linkedin.js";
import { looksLikeJobListingCopy } from "./screenAct.js";

export type PageStage =
  | "loading"
  | "captcha"
  | "listing"
  | "auth"
  | "form"
  | "review"
  | "submitted"
  | "blocked"
  | "unknown";

export type KeepAction = "wait" | "open-apply" | "auth" | "fill" | "advance" | "submit" | "handoff" | "skip";

export interface PageFacts {
  url: string;
  title?: string;
  bodyText: string;
  readyState?: string;
  visibleFieldCount?: number;
  requiredEmpty?: number;
  filledCount?: number;
  hasPassword?: boolean;
  hasFileInput?: boolean;
  authButtonCount?: number;
  captcha?: boolean;
  hasNext?: boolean;
  hasSubmit?: boolean;
  hasApplyCta?: boolean;
}

export interface PageAnalysis {
  stage: PageStage;
  action: KeepAction;
  board: string | null;
  reasons: string[];
  ready: boolean;
  fingerprint: string;
  fillBudget: number;
}

const LOADING =
  /please wait|loading application|loading\.\.\.|spinner|almost there|redirecting/i;
const SUBMITTED =
  /thank you for (your )?appl|application (has been )?(submitted|received|sent)|we (have )?received your application|successfully submitted/i;
const REVIEW =
  /review (your )?application|please review|confirm (your )?details|almost done|ready to submit/i;

export function pageFingerprint(facts: PageFacts): string {
  const head = (facts.title || "").slice(0, 40);
  const blob = (facts.bodyText || "").replace(/\s+/g, " ").slice(0, 80);
  return [
    facts.url.split("?")[0],
    facts.readyState || "",
    facts.visibleFieldCount ?? "-",
    facts.requiredEmpty ?? "-",
    facts.filledCount ?? "-",
    facts.captcha ? "c" : "",
    facts.hasPassword ? "p" : "",
    head,
    blob,
  ].join("|");
}

/** One-pass, no I/O. Read the page before the bot clicks or types. */
export function analyzeApplyPage(facts: PageFacts): PageAnalysis {
  const reasons: string[] = [];
  const board = atsHostOf(facts.url);
  const blob = facts.bodyText || "";
  const captcha = Boolean(facts.captcha) || pageLooksLikeCaptcha(blob);
  const fingerprint = pageFingerprint(facts);

  if (isLinkedInHost(facts.url)) {
    return pack("blocked", "skip", board, ["linkedin-blocked"], false, fingerprint, 0);
  }
  if (captcha) {
    return pack("captcha", "wait", board, ["captcha-wait-for-you"], false, fingerprint, 0);
  }

  const fields = facts.visibleFieldCount ?? 0;
  const loading =
    (facts.readyState && facts.readyState !== "complete" && fields === 0) ||
    (fields === 0 && LOADING.test(blob) && !looksLikeApplicationPage(facts.url, blob));
  if (loading) {
    return pack("loading", "wait", board, ["page-still-loading"], false, fingerprint, 0);
  }

  if (looksLikeConfirmationCopy(blob) && fields < 3) {
    return pack("submitted", "handoff", board, ["confirmation-page"], true, fingerprint, 0);
  }

  const applyPage = looksLikeApplicationPage(facts.url, blob);
  const listing = looksLikeJobListingCopy(blob);
  const applyCta = Boolean(facts.hasApplyCta) || /apply now|start application|apply for this job/i.test(blob);
  if (listing && applyCta && fields < 2 && !facts.hasPassword) {
    reasons.push("listing-with-apply");
    return pack("listing", "open-apply", board, reasons, true, fingerprint, 0);
  }

  const auth =
    Boolean(facts.hasPassword) ||
    (facts.authButtonCount || 0) > 0 ||
    looksLikeAuthWall(blob);
  if (auth && fields < 6) {
    reasons.push(facts.hasPassword ? "password-field" : "auth-wall");
    return pack("auth", "auth", board, reasons, true, fingerprint, 2);
  }

  if (!applyPage && !board && !facts.hasFileInput && fields === 0) {
    return pack("unknown", "skip", board, ["not-an-application"], false, fingerprint, 0);
  }

  if (REVIEW.test(blob) && (facts.requiredEmpty ?? 1) === 0) {
    reasons.push("review-step");
    if (facts.hasSubmit) return pack("review", "submit", board, reasons, true, fingerprint, 0);
    if (facts.hasNext) return pack("review", "advance", board, reasons, true, fingerprint, 0);
  }

  const requiredEmpty = facts.requiredEmpty ?? -1;
  const filled = facts.filledCount ?? 0;
  if (requiredEmpty === 0 && filled > 0) {
    if (facts.hasSubmit) return pack("form", "submit", board, ["required-complete"], true, fingerprint, 0);
    if (facts.hasNext) return pack("form", "advance", board, ["step-complete"], true, fingerprint, 0);
  }

  const simple = fields > 0 && fields <= 8 && !facts.hasPassword;
  if (simple) reasons.push("simple-form");
  else if (fields > 8) reasons.push("long-form");
  if (facts.hasFileInput) reasons.push("resume-upload");
  reasons.push("fill-real-fields");
  const budget = simple ? Math.max(KEEP_FIELDS_PER_TICK, 6) : KEEP_FIELDS_PER_TICK;
  return pack("form", "fill", board, reasons, true, fingerprint, budget);
}

function pack(
  stage: PageStage,
  action: KeepAction,
  board: string | null,
  reasons: string[],
  ready: boolean,
  fingerprint: string,
  fillBudget: number
): PageAnalysis {
  return { stage, action, board, reasons, ready, fingerprint, fillBudget };
}

/** Skip a full rescan when the page has not changed. */
export function analysisIsFresh(prev: PageAnalysis | null, facts: PageFacts): boolean {
  return Boolean(prev && prev.fingerprint === pageFingerprint(facts));
}

export function fillBudgetForAnalysis(analysis: PageAnalysis): number {
  return analysis.fillBudget || KEEP_FIELDS_PER_TICK;
}

export function analysisSummary(analysis: PageAnalysis): string {
  const board = analysis.board ? analysis.board.replace(/^\./, "") : "generic";
  return `${analysis.stage} → ${analysis.action} · ${board} · ${analysis.reasons.slice(0, 3).join(", ")}`;
}

export function looksLikeConfirmationCopy(text: string): boolean {
  return SUBMITTED.test(text || "");
}
