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
  const n = normalize(label);
  // Job-board "Apply" opens the form. Treat it as a step, not a finished submission.
  if (/^(apply|apply now|apply for this job|start application)$/.test(n)) return "next";
  if (isFinalSubmitLabel(label)) return "submit";
  if (isStepAdvanceLabel(label)) return "next";
  if (/^(save and continue|continue|next|next step|save & continue|continue application)$/.test(n)) return "next";
  if (/^(submit|submit application|submit my application)$/.test(n)) return "submit";
  return null;
}

/**
 * Only a visible challenge counts. ATS pages often load a hidden recaptcha
 * checkbox iframe and the words "I'm not a robot" — those must not freeze the loop.
 */
export function pageLooksLikeCaptcha(text: string, iframeSrcs: string[] = []): boolean {
  const blob = text.toLowerCase();
  if (/verify you are human|complete the captcha|select all (images|squares|pictures)|hcaptcha challenge/.test(blob)) {
    return true;
  }
  return iframeSrcs.some((s) => /recaptcha\/.*bframe|hcaptcha\.com\/captcha|arkoselabs|funcaptcha/i.test(s));
}

export function isCaptchaChallengeFrame(src: string, width = 0, height = 0): boolean {
  if (!/recaptcha\/.*bframe|hcaptcha\.com\/captcha|arkoselabs|funcaptcha/i.test(src)) return false;
  return width > 80 && height > 80;
}

/** Do not click final Submit while required fields are still empty. Next/Apply is fine. */
export function mayAdvance(kind: "next" | "submit" | null, requiredEmpty: number): boolean {
  if (kind === "next") return true;
  if (kind === "submit") return requiredEmpty === 0;
  return false;
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

export function canonicalJobUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.split("?")[0].replace(/\/$/, "").toLowerCase();
  }
}

export function nextQueueItem(queue: ApplyQueueItem[], currentUrl: string): ApplyQueueItem | null {
  if (!queue.length) return null;
  const cur = canonicalJobUrl(currentUrl);
  const i = queue.findIndex((q) => canonicalJobUrl(q.url) === cur);
  const next = i >= 0 ? queue[i + 1] : queue[0];
  return next || null;
}
