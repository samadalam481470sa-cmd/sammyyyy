import { normalize, tokenSetRatio } from "./fuzzy.js";
import { isFinalSubmitLabel, isStepAdvanceLabel } from "./submitGuard.js";

/** Pick the dropdown / radio option that matches a profile answer. */
export function matchOption(value: string, options: string[]): string | null {
  if (!value || !options.length) return null;
  const n = normalize(value);
  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  const exact = cleaned.find((o) => normalize(o) === n);
  if (exact) return exact;
  const contained = cleaned.find((o) => {
    const on = normalize(o);
    return on.includes(n) || n.includes(on);
  });
  if (contained) return contained;
  let best: { o: string; s: number } | null = null;
  for (const o of cleaned) {
    const s = tokenSetRatio(o, value);
    if (!best || s > best.s) best = { o, s };
  }
  return best && best.s >= 0.5 ? best.o : null;
}

export function classifyAdvanceLabel(label: string): "next" | "submit" | null {
  if (isFinalSubmitLabel(label)) return "submit";
  if (isStepAdvanceLabel(label)) return "next";
  const n = normalize(label);
  if (/^(save and continue|continue|next|next step|save & continue|continue application)$/.test(n)) return "next";
  if (/^(submit|apply|apply now|submit application)$/.test(n)) return "submit";
  return null;
}

export function pageLooksLikeCaptcha(text: string, iframeSrcs: string[] = []): boolean {
  const blob = `${text} ${iframeSrcs.join(" ")}`.toLowerCase();
  return (
    /recaptcha|hcaptcha|funcaptcha|verify you are human|i.m not a robot|complete the captcha/.test(blob) ||
    iframeSrcs.some((s) => /recaptcha|hcaptcha|arkoselabs|funcaptcha/i.test(s))
  );
}

/** Fillglen never solves CAPTCHAs. It waits on the open tab until a person finishes it. */
export function captchaPolicy(detected: boolean): "wait-for-human" | "continue" {
  return detected ? "wait-for-human" : "continue";
}

export function shouldLeavePageOnCaptcha(): boolean {
  return false;
}

export type KeepApplyStatus = "fill" | "advanced" | "submitted" | "captcha" | "blocked" | "stuck" | "done-job";

export interface ApplyQueueItem {
  url: string;
  title: string;
  company: string;
  source?: string;
}

export function nextQueueItem(queue: ApplyQueueItem[], currentUrl: string): ApplyQueueItem | null {
  if (!queue.length) return null;
  const i = queue.findIndex((q) => q.url === currentUrl);
  const next = i >= 0 ? queue[i + 1] : queue[0];
  return next || null;
}
