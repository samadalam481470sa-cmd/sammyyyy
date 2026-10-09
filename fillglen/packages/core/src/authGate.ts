import { normalize } from "./fuzzy.js";
import { canonicalJobUrl, type ApplyQueueItem } from "./applyLoop.js";

export type AuthGateAction = "last-application" | "create-account" | "sign-in" | "guest";

export interface BoardLogin {
  host: string;
  email: string;
  password: string;
  createdAt: string;
  lastUsedAt: string;
  appliedCount: number;
}

export function loginHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function classifyAuthGate(label: string): AuthGateAction | null {
  const n = normalize(label);
  if (!n) return null;
  if (
    /use (my )?(last|previous) (application|resume|cv|data)|autofill with (my )?(last|previous)|apply with (my )?(last|previous)|last application|previous application|returning candidate|i('m| am) a returning/.test(
      n
    )
  ) {
    return "last-application";
  }
  if (
    /create (an )?account|sign up|signup|register|new user|i('m| am) new|i don't have an account|i do not have an account/.test(
      n
    )
  ) {
    return "create-account";
  }
  if (/continue as guest|apply as guest|guest apply/.test(n)) return "guest";
  if (/^(sign in|log in|login|already have an account|i have an account)$/.test(n) || /sign in to|log in to/.test(n)) {
    return "sign-in";
  }
  return null;
}

export function pickAuthGate(
  buttons: { label: string }[],
  returning: boolean,
  canSignIn = true
): { label: string; action: AuthGateAction } | null {
  const labeled = buttons
    .map((b) => ({ label: b.label, action: classifyAuthGate(b.label) }))
    .filter((b): b is { label: string; action: AuthGateAction } => Boolean(b.action));
  if (returning) {
    return (
      labeled.find((b) => b.action === "last-application") ||
      (canSignIn ? labeled.find((b) => b.action === "sign-in") : null) ||
      null
    );
  }
  return labeled.find((b) => b.action === "create-account") || labeled.find((b) => b.action === "guest") || null;
}

export function classifyAppliedBeforeChoice(label: string): "yes" | "no" | null {
  const n = normalize(label);
  if (!n) return null;
  if (/never applied|first time|new candidate|have not applied|haven't applied|no[,.]? this is my first/.test(n)) {
    return "no";
  }
  if (/have applied|applied before|previous applicant|existing candidate|yes[,.]? i have/.test(n)) return "yes";
  if (/^yes$/.test(n)) return "yes";
  if (/^no$/.test(n)) return "no";
  return null;
}

export function looksLikeAppliedBeforePrompt(text: string): boolean {
  return /have you (already )?applied|applied to (this )?(company|job) before|existing candidate|previous application/.test(
    normalize(text)
  );
}

export function priorLogin(logins: BoardLogin[], host: string): BoardLogin | null {
  if (!host) return null;
  return logins.find((row) => row.host === host || host.endsWith(`.${row.host}`) || row.host.endsWith(`.${host}`)) || null;
}

export function hostHasPriorApply(
  host: string,
  logins: BoardLogin[],
  liveJobs: Pick<ApplyQueueItem, "url" | "appliedAt">[] = [],
  url = ""
): boolean {
  if (priorLogin(logins, host)) return true;
  const key = url ? canonicalJobUrl(url) : "";
  return liveJobs.some((j) => {
    if (!j.appliedAt) return false;
    if (key && canonicalJobUrl(j.url) === key) return true;
    return loginHost(j.url) === host;
  });
}

export function deriveBoardPassword(email: string, host: string, secret: string): string {
  const raw = `${secret}|${normalize(email)}|${normalize(host)}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = Math.abs(h).toString(36);
  const b = Math.abs(h ^ 0x9e3779b9).toString(36);
  return `Fg!${a}${b}A9`.replace(/[^A-Za-z0-9!]/g, "x").slice(0, 18);
}

export function randomVaultSecret(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (n) => (n % 36).toString(36)).join("");
}

export function upsertBoardLogin(
  logins: BoardLogin[],
  row: { host: string; email: string; password: string; applied?: boolean }
): BoardLogin[] {
  const now = new Date().toISOString();
  const host = row.host;
  if (!host || !row.email) return logins;
  const next = logins.filter((l) => l.host !== host);
  const prev = logins.find((l) => l.host === host);
  next.push({
    host,
    email: row.email,
    password: row.password,
    createdAt: prev?.createdAt || now,
    lastUsedAt: now,
    appliedCount: (prev?.appliedCount || 0) + (row.applied ? 1 : 0),
  });
  return next;
}

export function loginForFill(
  logins: BoardLogin[],
  url: string,
  email: string,
  secret: string
): { login: BoardLogin; logins: BoardLogin[]; created: boolean } {
  const host = loginHost(url);
  const existing = priorLogin(logins, host);
  if (existing) return { login: existing, logins, created: false };
  const password = deriveBoardPassword(email, host, secret);
  const updated = upsertBoardLogin(logins, { host, email, password });
  return { login: priorLogin(updated, host)!, logins: updated, created: true };
}

export function looksLikeAuthWall(text: string): boolean {
  const n = normalize(text);
  if (looksLikeAppliedBeforePrompt(text)) return true;
  return /create (an )?account|sign up|sign in|log in|use (my )?(last|previous) (application|resume)|already have an account|forgot password|verify (your )?email/.test(
    n
  );
}

export function isPasswordLabel(label: string): boolean {
  const n = normalize(label);
  return /password|passcode|pass phrase/.test(n);
}

export function ensureVaultSecret(existing?: string | null): string {
  return existing && existing.length >= 8 ? existing : randomVaultSecret();
}

/** Prefetch tabs stay idle. The active apply tab keeps running even in the background. */
export function shouldSkipWarmupFill(pageUrl: string, warmupUrl?: string | null): boolean {
  if (!warmupUrl) return false;
  return canonicalJobUrl(pageUrl) === canonicalJobUrl(warmupUrl);
}

export function decideKeepAuth(input: {
  buttons: { label: string }[];
  returning: boolean;
  canSignIn: boolean;
  appliedBeforePrompt: boolean;
}): { appliedBefore?: "yes" | "no"; gate?: { label: string; action: AuthGateAction } } {
  const appliedBefore = input.appliedBeforePrompt ? (input.returning ? "yes" : "no") : undefined;
  const gate = pickAuthGate(input.buttons, input.returning, input.canSignIn) || undefined;
  return { appliedBefore, gate };
}
