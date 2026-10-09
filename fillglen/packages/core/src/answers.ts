import { matchOption } from "./applyLoop.js";
import { normalize, tokens } from "./fuzzy.js";
import type { Profile, Question, QuestionType } from "./types.js";

const DECLINE = [
  "decline to self-identify",
  "decline to self identify",
  "i do not wish to answer",
  "i dont wish to answer",
  "i don't wish to answer",
  "prefer not to say",
  "prefer not to answer",
  "i do not want to answer",
  "decline to answer",
  "choose not to disclose",
  "i do not wish to identify",
  "do not wish to identify",
  "opt out",
];

const NOT_VETERAN = [
  "i am not a protected veteran",
  "i am not a veteran",
  "not a protected veteran",
  "no i am not a protected veteran",
  "no",
];

const NO_DISABILITY = [
  "no i do not have a disability",
  "no i dont have a disability",
  "i do not have a disability",
  "i don't have a disability",
  "no disability",
  "no",
];

const US_CITIZEN = [
  "us citizen",
  "u.s. citizen",
  "united states citizen",
  "citizen of the united states",
  "united states",
  "usa",
  "us",
  "yes",
  "us person",
  "u.s. person",
];

const CONSENT_HINT = /terms and conditions|i have read|i agree|consent to|privacy policy|i accept/;

export function isConsentLabel(label: string): boolean {
  const n = normalize(label);
  return CONSENT_HINT.test(n) || /^(yes[,.]?\s+i have read|i agree to)/.test(n);
}

export function isGoogleSignInLabel(label: string): boolean {
  const n = normalize(label);
  if (!/google/.test(n)) return false;
  if (/calendar|maps|drive|docs|analytics/.test(n)) return false;
  return /(sign|log|continue|create)/.test(n);
}

export function looksLikeGoogleAccountChooser(text: string): boolean {
  const n = normalize(text);
  return /choose an account|select you to continue|signed in as/.test(n) || /@gmail\.com|@googlemail\.com/.test(text);
}

export function firstEmailInText(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function findByAliases(options: string[], aliases: string[]): string | null {
  const cleaned = options.map((o) => o.trim()).filter((o) => o && !isPlaceholderOption(o));
  for (const alias of aliases) {
    const hit = matchOption(alias, cleaned);
    if (hit) return hit;
  }
  const aliasSet = new Set(aliases.map(normalize));
  return cleaned.find((o) => aliasSet.has(normalize(o))) || null;
}

export function isPlaceholderOption(option: string): boolean {
  return /^(select|please select|choose|choose one|select an option|-|--)$/i.test(normalize(option));
}

export function pickDecline(options: string[]): string | null {
  return findByAliases(options, DECLINE);
}

export function pickDemographicOption(type: QuestionType | "consent" | "citizenship", preferred: string, options: string[] = []): string {
  if (!options.length) return preferred;
  const usable = options.filter((o) => !isPlaceholderOption(o));
  if (preferred) {
    const direct = matchOption(preferred, usable);
    if (direct) return direct;
  }
  if (type === "veteran") return findByAliases(usable, [...NOT_VETERAN, ...DECLINE]) || preferred;
  if (type === "disability") return findByAliases(usable, [...NO_DISABILITY, ...DECLINE]) || preferred;
  if (type === "gender" || type === "race") return pickDecline(usable) || preferred;
  if (type === "citizenship" || type === "workAuthorization") {
    return (
      findByAliases(usable, [...US_CITIZEN, "i am authorized", "authorized to work", "legally authorized", "eligible to work"]) ||
      matchOption("Yes", usable) ||
      preferred
    );
  }
  if (type === "consent") {
    return findByAliases(usable, ["yes", "i agree", "i accept", "agree"]) || usable[0] || preferred;
  }
  return matchOption(preferred, usable) || preferred;
}

export function pickCitizenAnswer(options?: string[]): string {
  if (!options?.length) return "United States";
  return pickDemographicOption("citizenship", "US Citizen", options);
}

export function yearsFromWork(profile: Profile): number {
  let years = 0;
  const now = new Date().getFullYear();
  for (const job of profile.work) {
    const start = parseInt((job.startDate || "").slice(0, 4), 10);
    const end = /present|current/i.test(job.endDate || "") ? now : parseInt((job.endDate || "").slice(0, 4), 10);
    if (start) years += Math.max(0, (end || now) - start);
  }
  return years || (profile.skills.some((s) => s.years > 0) ? Math.max(...profile.skills.map((s) => s.years)) : 0);
}

export function bestEffortAnswer(question: Question, profile: Profile): string {
  const label = normalize(question.label);
  const options = question.options || [];
  if (isConsentLabel(question.label) || question.type === "consent") {
    return pickDemographicOption("consent", "Yes", options.length ? options : ["Yes"]);
  }
  if (question.type === "citizenship" || /citizen|nationality|us person|u s person/.test(label)) {
    return pickCitizenAnswer(options);
  }
  if (/18 years|over 18|at least 18|age 18/.test(label)) {
    return matchOption("Yes", options) || "Yes";
  }
  if (/how did you hear|where did you hear|referral source|source of this/.test(label)) {
    return matchOption("Company website", options) || matchOption("Career site", options) || "Company careers page";
  }
  if (/authorized to work|legally authorized|eligible to work|work authorization/.test(label)) {
    return pickDemographicOption("workAuthorization", "Yes", options);
  }
  if (/visa sponsorship|require sponsorship|need sponsorship/.test(label)) {
    return matchOption("No", options) || "No";
  }
  if (/relocat/.test(label)) {
    const yn = profile.preferences.relocation ? "Yes" : "No";
    return matchOption(yn, options) || yn;
  }
  if (/years of experience|how many years|years experience/.test(label)) {
    const y = yearsFromWork(profile);
    if (!y) return options[0] && !isPlaceholderOption(options[0]) ? options[0] : "1";
    const asText = String(y);
    return matchOption(asText, options) || asText;
  }
  if (question.kind === "checkbox" && CONSENT_HINT.test(label)) return "Yes";
  if ((question.type === "motivation" || question.type === "behavioral" || question.type === "unknown") && shouldInventFromFacts(label)) {
    return shortFactualAnswer(profile, question.label);
  }
  if (question.required && options.length >= 2 && options.length <= 6) {
    const yes = matchOption("Yes", options);
    if (yes && /able|can you|do you|willing|agree/.test(label)) return yes;
    const no = matchOption("No", options);
    if (no && /felony|convict|sponsor/.test(label)) return no;
  }
  return "";
}

function shouldInventFromFacts(label: string): boolean {
  return /why|tell us|describe|cover letter|interest|motivat|about yourself|summary/.test(label);
}

export function shortFactualAnswer(profile: Profile, questionLabel: string): string {
  const title = profile.work[0]?.title || "software professional";
  const city = [profile.contact.city, profile.contact.state].filter(Boolean).join(", ") || "the United States";
  const skills = profile.skills
    .slice(0, 6)
    .map((s) => s.name)
    .filter(Boolean)
    .join(", ");
  const company = profile.work[0]?.company;
  const bits = [
    `I'm a US citizen and ${title} based in ${city}.`,
    skills ? `My background includes ${skills}.` : "",
    company ? `Most recently I worked at ${company}.` : "",
    /why|interest/.test(normalize(questionLabel)) ? "I want this role because it matches that background." : "I can start on a reasonable timeline and I'm authorized to work in the United States without sponsorship.",
  ];
  return bits.filter(Boolean).join(" ");
}

export function fieldLooksFilled(kind: Question["kind"], value: string): boolean {
  const v = (value || "").trim();
  if (!v || v === "false" || v === "off" || v === "0") return false;
  if (isPlaceholderOption(v)) return false;
  return true;
}

export function applicationStats(
  applications: { status: string; createdAt: string }[]
): { week: number; applied: number; responses: number; responseRate: string } {
  const week = applications.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 7 * 86400000).length;
  const progressed = new Set(["phone-screen", "technical", "final", "offer"]);
  const appliedSet = new Set(["applied", "phone-screen", "technical", "final", "offer", "rejected", "no-response", "withdrawn"]);
  const applied = applications.filter((a) => appliedSet.has(a.status)).length;
  const responses = applications.filter((a) => progressed.has(a.status)).length;
  const responseRate = applied ? `${Math.round((responses / applied) * 100)}%` : "—";
  return { week, applied, responses, responseRate };
}

export function titleRelevance(jobTitle: string, targetTitles: string[]): number {
  const weak = new Set(["engineer", "developer", "specialist", "manager", "analyst", "assistant", "lead", "senior", "junior", "staff", "ii", "iii"]);
  const n = normalize(jobTitle);
  let best = 0;
  for (const raw of targetTitles) {
    const t = normalize(raw);
    if (!t) continue;
    if (n.includes(t) || t.includes(n)) return 1;
    const distinctive = tokens(t).filter((x) => !weak.has(x));
    const jobTok = new Set(tokens(jobTitle));
    const distHit = distinctive.filter((x) => jobTok.has(x)).length;
    const overlap = distinctive.length ? distHit / distinctive.length : 0;
    const sharedWeak = tokens(t).filter((x) => jobTok.has(x)).length;
    const ratio = tokens(t).length ? sharedWeak / tokens(t).length : 0;
    const score = distinctive.length ? overlap * 0.8 + ratio * 0.2 : ratio;
    if (score > best) best = score;
  }
  return best;
}
