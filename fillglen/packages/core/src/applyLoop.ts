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
  location?: string;
  score?: number;
  why?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  openedAt?: string;
  appliedAt?: string;
}

/** Keep discovered jobs on the Live jobs list. New hits move to the top; old rows stay. */
export function mergeLiveJobs(existing: ApplyQueueItem[], incoming: ApplyQueueItem[], limit = 200): ApplyQueueItem[] {
  const now = new Date().toISOString();
  const map = new Map<string, ApplyQueueItem>();
  for (const j of existing) {
    if (!j?.url) continue;
    map.set(canonicalJobUrl(j.url), { ...j });
  }
  for (const j of incoming) {
    if (!j?.url) continue;
    const key = canonicalJobUrl(j.url);
    const prev = map.get(key);
    map.set(key, {
      ...prev,
      ...j,
      url: j.url || prev?.url || "",
      firstSeenAt: prev?.firstSeenAt || now,
      lastSeenAt: now,
      openedAt: prev?.openedAt,
      appliedAt: prev?.appliedAt || j.appliedAt,
    });
  }
  const merged = [...map.values()].sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""));
  return merged.slice(0, limit);
}

export function markLiveJob(
  list: ApplyQueueItem[],
  url: string,
  patch: Partial<Pick<ApplyQueueItem, "openedAt" | "appliedAt">>
): ApplyQueueItem[] {
  const key = canonicalJobUrl(url);
  return list.map((j) => (canonicalJobUrl(j.url) === key ? { ...j, ...patch } : j));
}

export function canonicalJobUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.split("?")[0].replace(/\/$/, "").toLowerCase();
  }
}

/** Skip the current listing and any already-applied rows; wrap so the queue does not stall. */
export function nextQueueItem(queue: ApplyQueueItem[], currentUrl: string): ApplyQueueItem | null {
  if (!queue.length) return null;
  const cur = canonicalJobUrl(currentUrl);
  const i = queue.findIndex((q) => canonicalJobUrl(q.url) === cur);
  const rest = i >= 0 ? [...queue.slice(i + 1), ...queue.slice(0, i)] : queue;
  return rest.find((q) => q.url && !q.appliedAt) || null;
}

export const KEEP_FILL_GAP_MS = 16;
export const KEEP_INTERVAL_MS = 180;
export const KEEP_STUCK_TICKS = 8;
export const KEEP_SCAN_BURST_MS = [40, 160, 400, 800];
export const KEEP_MUTATION_DEBOUNCE_MS = 50;

export type HandoffReason = "submitted" | "stuck" | "blocked" | "done-job";

export interface HandoffPlan {
  next: ApplyQueueItem | null;
  useWarmup: boolean;
  closeCurrentAfterMs: number;
  prefetchUrl: string | null;
}

/**
 * Instantly show the next application (a background-warmed tab when ready).
 * After Submit, keep the old tab around briefly so the POST can finish.
 */
export function handoffPlan(input: {
  queue: ApplyQueueItem[];
  currentUrl: string;
  warmupUrl?: string | null;
  warmupTabId?: number | null;
  reason: HandoffReason;
}): HandoffPlan {
  const next = nextQueueItem(input.queue, input.currentUrl);
  if (!next) return { next: null, useWarmup: false, closeCurrentAfterMs: 0, prefetchUrl: null };
  const useWarmup = Boolean(
    input.warmupTabId && input.warmupUrl && canonicalJobUrl(input.warmupUrl) === canonicalJobUrl(next.url)
  );
  const closeCurrentAfterMs = input.reason === "submitted" ? 450 : 60;
  const after = nextQueueItem(input.queue, next.url);
  const prefetchUrl =
    after && canonicalJobUrl(after.url) !== canonicalJobUrl(input.currentUrl) ? after.url : null;
  return { next, useWarmup, closeCurrentAfterMs, prefetchUrl };
}
