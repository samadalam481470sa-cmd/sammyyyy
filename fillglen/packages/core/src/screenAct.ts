import { normalize } from "./fuzzy.js";

export type FillPace = "fast" | "slow";

export const KEEP_FAST_INTERVAL_MS = 90;
export const KEEP_SLOW_INTERVAL_MS = 720;
export const KEEP_SLOW_GAP_MS = 160;
export const KEEP_SLOW_CHAR_MS = 42;

const DETECTED =
  /unusual activity|automated (traffic|browser|behavior)|bot detected|please (slow down|try again)|access denied|temporarily blocked|too many requests|rate limit|suspicious (activity|behavior)|attention required|just a moment|checking your browser|enable javascript|verify (you are|it's you)|we detected|not a robot|security check/;

const NEVER =
  /log ?out|sign ?out|delete (my )?account|close account|withdraw( application)?|cancel application|not interested|skip (this )?(company|job)|unsubscribe|report (job|user)|block (user|company)|unfollow|easy apply|share (on|via)|tweet|facebook|instagram|pinterest|delete resume|remove account|disable (keep|autofill)/;

const ACT =
  /accept( all)?( cookies)?|agree|i agree|got it|okay|^ok$|continue|next|apply( now)?|save( and continue)?|add (another|education|experience|job|school)|upload( resume| cv| file)?|browse|attach( file)?|select file|choose file|use last (application|resume)|create( an)? account|sign up|allow( all)?|yes,? continue|start application|i('m| am) not a robot/;

export function pageLooksDetected(text: string): boolean {
  return DETECTED.test(normalize(text));
}

export function fillPaceForPage(text: string): FillPace {
  return pageLooksDetected(text) ? "slow" : "fast";
}

export function classifyScreenControl(label: string): "act" | "never" | null {
  const n = normalize(label);
  if (!n || n.length > 80) return null;
  if (NEVER.test(n)) return "never";
  if (ACT.test(n)) return "act";
  return null;
}

export function pickScreenAction(
  buttons: { label: string }[]
): { label: string; kind: "act" } | null {
  for (const b of buttons) {
    if (classifyScreenControl(b.label) === "act") return { label: b.label, kind: "act" };
  }
  return null;
}
