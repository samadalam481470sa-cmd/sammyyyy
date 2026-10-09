import { fieldLooksFilled } from "./answers.js";
import { KEEP_COOLDOWN_MS } from "./applyLoop.js";
import { classifyFillControl, isDropdownFieldKind, isDropdownQuestionType } from "./dropdown.js";
import type { ReadyFill } from "./fillPipeline.js";
import type { FieldKind, Question } from "./types.js";

/** Scan never dumps a page-worth of fills — that is what froze Workday mid-form. */
export const KEEP_SCAN_FILL_LIMIT = 0;
export const KEEP_FULL_SCAN_GAP_MS = 1800;
export const KEEP_DELTA_SCAN_GAP_MS = 500;
export const KEEP_RESUME_GAP_MS = 8000;
export const KEEP_TEXT_CACHE_MS = 400;
export const KEEP_COOLDOWN_AFTER_FILL_MS = 280;
export const KEEP_COOLDOWN_AFTER_DROPDOWN_MS = 400;
export const KEEP_DROPDOWNS_PER_TICK = 1;
export const KEEP_RESTORE_WRITES = 4;

export function scanMayAutofill(limit = KEEP_SCAN_FILL_LIMIT): number {
  return Math.max(0, Math.min(limit, KEEP_SCAN_FILL_LIMIT));
}

export function shouldScanNow(lastAt: number, minGap: number, now = Date.now()): boolean {
  return lastAt <= 0 || now - lastAt >= minGap;
}

export function shouldRetryResume(lastAt: number, alreadyDid: boolean, now = Date.now()): boolean {
  if (alreadyDid) return false;
  return lastAt <= 0 || now - lastAt >= KEEP_RESUME_GAP_MS;
}

export function isStaleCycle(mine: number, current: number): boolean {
  return mine !== current;
}

export function bumpCycle(current: number): number {
  return current + 1;
}

/** Once a tick verified a field this step, do not open it again even if the ATS cleared the input. */
export function skipFilledThisStep(
  id: string,
  filledIds: Iterable<string>,
  liveValue: string,
  kind: FieldKind
): boolean {
  const known = [...filledIds].includes(id);
  if (!known) return false;
  if (fieldLooksFilled(kind, liveValue)) return true;
  return known;
}

export function takeTickBatch(
  ready: ReadyFill[],
  maxFields: number,
  maxDropdowns = KEEP_DROPDOWNS_PER_TICK
): ReadyFill[] {
  const out: ReadyFill[] = [];
  let dropdowns = 0;
  for (const item of ready) {
    const drop = classifyFillControl(item.question.kind, item.question.type) !== "type";
    if (drop) {
      if (out.length) break;
      if (dropdowns >= maxDropdowns) continue;
      out.push(item);
      dropdowns += 1;
      break;
    }
    if (out.length >= maxFields) break;
    out.push(item);
  }
  return out;
}

export function cooldownAfterTick(filledCount: number, hadDropdown: boolean): number {
  if (hadDropdown) return KEEP_COOLDOWN_AFTER_DROPDOWN_MS;
  if (filledCount > 0) return KEEP_COOLDOWN_AFTER_FILL_MS;
  return KEEP_COOLDOWN_MS;
}

export function mayRestoreFieldWrite(
  restoredAlready: boolean,
  writesSoFar: number,
  question: Pick<Question, "kind" | "type" | "value">,
  liveValue: string
): boolean {
  if (restoredAlready) return false;
  if (writesSoFar >= KEEP_RESTORE_WRITES) return false;
  if (isDropdownFieldKind(question.kind) || isDropdownQuestionType(question.type)) return false;
  if (!question.value || fieldLooksFilled(question.kind, liveValue)) return false;
  return true;
}
