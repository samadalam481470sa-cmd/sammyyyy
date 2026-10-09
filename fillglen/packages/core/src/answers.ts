import { matchOption } from "./applyLoop.js";
import { normalize, tokens } from "./fuzzy.js";
import { resumeBlob } from "./matchScore.js";
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

const SOUTH_ASIAN = [
  "south asian",
  "asian indian",
  "asian (south asian)",
  "indian",
  "asian",
];

const US_COUNTRY = [
  "united states",
  "united states of america",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "+1",
  "united states (+1)",
  "usa (+1)",
  "us (+1)",
  "1",
];

export function pickDemographicOption(
  type: QuestionType | "consent" | "citizenship" | "country",
  preferred: string,
  options: string[] = []
): string {
  if (!options.length) return preferred;
  const usable = options.filter((o) => !isPlaceholderOption(o));
  if (preferred) {
    const direct = matchOption(preferred, usable);
    if (direct) return direct;
  }
  if (type === "veteran") return findByAliases(usable, [...NOT_VETERAN, "no i am not a veteran", "no", ...DECLINE]) || preferred;
  if (type === "disability") return findByAliases(usable, [...NO_DISABILITY, ...DECLINE]) || preferred;
  if (type === "gender") {
    if (/decline|wish to answer|prefer not|do not wish/.test(normalize(preferred))) {
      return findByAliases(usable, [...DECLINE, preferred]) || preferred;
    }
    return findByAliases(usable, [preferred, "male", ...DECLINE]) || preferred;
  }
  if (type === "race") {
    if (/decline|wish to answer|prefer not|do not wish/.test(normalize(preferred))) {
      return findByAliases(usable, [...DECLINE, preferred]) || preferred;
    }
    return findByAliases(usable, [...SOUTH_ASIAN, preferred, ...DECLINE]) || preferred;
  }
  if (type === "transgender") return findByAliases(usable, ["no", preferred, ...DECLINE]) || preferred;
  if (type === "sexualOrientation") return findByAliases(usable, [...DECLINE, preferred]) || preferred;
  if (type === "firstGeneration") return findByAliases(usable, ["yes", preferred]) || preferred;
  if (type === "country") return findByAliases(usable, [...US_COUNTRY, preferred]) || preferred;
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

export function pickCountryAnswer(label: string, options?: string[]): string {
  const n = normalize(label);
  const codeish = /country code|dial(l)?ing code|phone country|calling code/.test(n);
  if (!options?.length) return codeish ? "United States" : "United States";
  const hit = pickDemographicOption("country", "United States", options);
  if (hit) return hit;
  if (codeish) return findByAliases(options, US_COUNTRY) || "United States";
  return "United States";
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
  if (question.type === "country" || /country code|dial(l)?ing code|phone country|calling code|^country$/.test(label)) {
    return pickCountryAnswer(question.label, options);
  }
  if (question.type === "zip" || /zip|postal/.test(label)) {
    return profile.contact.zip || "75006";
  }
  if (question.type === "transgender" || /transgender/.test(label)) {
    return pickDemographicOption("transgender", profile.selfIdentification.transgender || "No", options);
  }
  if (question.type === "sexualOrientation" || /sexual orientation/.test(label)) {
    return pickDemographicOption(
      "sexualOrientation",
      profile.selfIdentification.sexualOrientation || "I don't wish to answer",
      options
    );
  }
  if (question.type === "firstGeneration" || /first.?generation/.test(label)) {
    return pickDemographicOption("firstGeneration", profile.selfIdentification.firstGeneration || "Yes", options);
  }
  if (question.type === "gender" || /gender identity|what is your sex|^sex$/.test(label)) {
    return pickDemographicOption("gender", profile.selfIdentification.gender || "Male", options);
  }
  if (question.type === "race" || /race|ethnicity/.test(label)) {
    return pickDemographicOption("race", profile.selfIdentification.race || "South Asian", options);
  }
  if (question.type === "veteran" || /veteran/.test(label)) {
    return pickDemographicOption("veteran", profile.selfIdentification.veteran || "No, I am not a veteran", options);
  }
  if (question.type === "disability" || /disability|disabled/.test(label)) {
    return pickDemographicOption("disability", profile.selfIdentification.disability || "No", options);
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
    if (profileHasResumeFacts(profile)) return shortFactualAnswer(profile, question.label);
  }
  const fromResume = answerFromResume(question, profile);
  if (fromResume) return fromResume;
  if (question.required && options.length >= 2 && options.length <= 6) {
    const no = matchOption("No", options);
    if (no && /felony|convict|sponsor/.test(label)) return no;
  }
  if (isIdentityQuestion(question.type)) return "";
  return fallbackNo(question);
}

const IDENTITY_TYPES = new Set<QuestionType>([
  "email",
  "phone",
  "firstName",
  "lastName",
  "fullName",
  "preferredName",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "linkedin",
  "github",
  "portfolio",
  "website",
  "resume",
  "gender",
  "race",
  "veteran",
  "disability",
  "transgender",
  "sexualOrientation",
  "firstGeneration",
  "citizenship",
  "consent",
  "password",
]);

export function isIdentityQuestion(type: QuestionType): boolean {
  return IDENTITY_TYPES.has(type);
}

export function profileHasResumeFacts(profile: Profile): boolean {
  return Boolean(
    profile.rawResumeText ||
      profile.skills.length ||
      profile.work.length ||
      profile.contact.legalName ||
      profile.contact.email
  );
}

const QUESTION_STOP = new Set([
  "have",
  "has",
  "this",
  "that",
  "with",
  "from",
  "your",
  "you",
  "are",
  "was",
  "were",
  "will",
  "the",
  "and",
  "for",
  "any",
  "please",
  "select",
  "choose",
  "question",
  "following",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "should",
  "does",
  "did",
  "can",
  "may",
  "been",
  "being",
  "about",
  "into",
  "able",
  "willing",
  "experience",
  "experiences",
  "background",
  "years",
  "role",
  "position",
  "company",
  "job",
  "work",
  "working",
  "currently",
  "current",
  "previous",
  "prior",
  "describe",
  "tell",
  "list",
  "provide",
  "enter",
  "type",
  "name",
  "yes",
  "true",
  "false",
  "ever",
  "also",
  "other",
  "others",
  "using",
  "used",
  "include",
  "including",
  "required",
  "require",
  "must",
  "need",
  "needs",
  "how",
  "many",
  "much",
]);

export function resumeFacts(profile: Profile): string[] {
  const out: string[] = [];
  for (const s of profile.skills) if (s.name) out.push(s.name);
  for (const w of profile.work) {
    if (w.company) out.push(w.company);
    if (w.title) out.push(w.title);
    for (const b of w.bullets || []) if (b.text) out.push(b.text);
  }
  for (const e of profile.education) {
    if (e.school) out.push(e.school);
    if (e.degree) out.push(e.degree);
    if (e.major) out.push(e.major);
  }
  const c = profile.contact;
  for (const v of [c.city, c.state, c.legalName, c.email, c.phone]) {
    if (v) out.push(v);
  }
  return out;
}

function blobHasPhrase(blob: string, phrase: string): boolean {
  const n = normalize(phrase);
  if (n.length < 2) return false;
  return ` ${blob} `.includes(` ${n} `);
}

/** Pull an answer from the pasted resume. Empty means the resume does not cover it. */
export function answerFromResume(question: Question, profile: Profile): string {
  const blob = resumeBlob(profile);
  if (!blob) return "";
  const label = normalize(question.label);
  const options = question.options || [];
  const facts = resumeFacts(profile);
  const factHits = facts.filter((f) => {
    const n = normalize(f);
    return n.length >= 2 && label.includes(n) && blobHasPhrase(blob, f);
  });
  const distinctive = tokens(question.label).filter((t) => t.length > 3 && !QUESTION_STOP.has(t));
  const long = distinctive.filter((t) => t.length >= 5);
  const yesNo =
    (options.some((o) => /^yes$/i.test(o.trim())) && options.some((o) => /^no$/i.test(o.trim()))) ||
    /^(do you|are you|have you|can you|will you|did you|is it|were you)/.test(label);

  if (yesNo) {
    const allLongOnResume = long.length > 0 && long.every((t) => blobHasPhrase(blob, t));
    if (factHits.length || allLongOnResume) return matchOption("Yes", options) || "Yes";
    return "";
  }

  if (/skill|technolog|language|framework|tool/.test(label) && profile.skills.length) {
    return profile.skills
      .slice(0, 8)
      .map((s) => s.name)
      .filter(Boolean)
      .join(", ");
  }

  if (factHits.length) {
    const skill = profile.skills.find((s) => factHits.some((h) => normalize(s.name) === normalize(h)));
    if (skill) return skill.name;
    const line = (profile.rawResumeText || "")
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l && factHits.some((h) => normalize(l).includes(normalize(h))));
    if (line && line.length <= 220) return line;
    return factHits[0];
  }

  const tokenHits = distinctive.filter((t) => blobHasPhrase(blob, t));
  if (tokenHits.length >= 2 || (tokenHits.length === 1 && tokenHits[0].length >= 6)) {
    const line = (profile.rawResumeText || "")
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l && tokenHits.some((h) => normalize(l).includes(h)));
    if (line && line.length <= 220) return line;
    const skill = profile.skills.find((s) =>
      tokenHits.some((h) => normalize(s.name).includes(h) || h.includes(normalize(s.name)))
    );
    if (skill) return skill.name;
  }
  return "";
}

export function fallbackNo(question: Question): string {
  if (isIdentityQuestion(question.type)) return "";
  const options = question.options || [];
  return matchOption("No", options) || "No";
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
  if (kind === "file") return Boolean(v) && v !== "false";
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
