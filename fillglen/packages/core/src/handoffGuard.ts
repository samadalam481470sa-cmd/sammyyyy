import type { HandoffReason } from "./applyLoop.js";

export interface SubmitEvidence {
  clickedSubmit?: boolean;
  confirmationPage?: boolean;
  confirmationUrl?: boolean;
}

export interface HandoffGateInput {
  reason: HandoffReason;
  evidence?: SubmitEvidence | null;
}

export interface HandoffGate {
  ok: boolean;
  why: string;
}

const CONFIRM_PATH =
  /\/(thank-?you|thanks|confirmation|submitted|success|application-complete|receipt|applied)(\/|$|\?)/i;

/** URL after a real submit — not job-description copy. */
export function looksLikeConfirmationUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname + new URL(url).search;
    return CONFIRM_PATH.test(path);
  } catch {
    return CONFIRM_PATH.test(url);
  }
}

/**
 * Only leave the current listing after a real submit (or a blocked page we cannot apply on).
 * Stuck / empty-field states stay on this application.
 */
export function mayHandoffToNextJob(input: HandoffGateInput): HandoffGate {
  if (input.reason === "blocked") return { ok: true, why: "blocked-page" };
  if (input.reason === "stuck") return { ok: false, why: "stay-until-submit" };
  if (input.reason !== "submitted" && input.reason !== "done-job") {
    return { ok: false, why: "not-a-submit" };
  }
  const ev = input.evidence || {};
  if (ev.clickedSubmit && (ev.confirmationPage || ev.confirmationUrl)) {
    return { ok: true, why: "submit-confirmed" };
  }
  if (ev.clickedSubmit) return { ok: true, why: "submit-clicked" };
  if (ev.confirmationUrl) return { ok: true, why: "confirm-url" };
  return { ok: false, why: "no-submit-evidence" };
}

/** Soft stuck: keep trying this form. Never treat it as permission to open the next job. */
export function stuckMeansStay(): true {
  return true;
}

export const KEEP_CYCLE_BUDGET_MS = 1400;
export const KEEP_BUSY_WATCHDOG_MS = 12000;
export const KEEP_SUBMIT_CONFIRM_MS = 650;
export const KEEP_HANDOFF_SETTLE_MS = 280;
export const KEEP_CLOSE_AFTER_SUBMIT_MS = 800;

export function cycleOverBudget(startedAt: number, now = Date.now()): boolean {
  return now - startedAt >= KEEP_CYCLE_BUDGET_MS;
}

export function keepBusyExpired(busySince: number, now = Date.now()): boolean {
  return busySince > 0 && now - busySince >= KEEP_BUSY_WATCHDOG_MS;
}

export function submitWaitElapsed(clickedAt: number, now = Date.now()): boolean {
  return clickedAt > 0 && now - clickedAt >= KEEP_SUBMIT_CONFIRM_MS;
}
