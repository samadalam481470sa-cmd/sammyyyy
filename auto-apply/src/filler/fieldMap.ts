export const FIELD_SYNONYMS: Record<string, string[]> = {
  firstName: ["first name", "given name", "legal first name"],
  lastName: ["last name", "family name", "surname"],
  fullName: ["full name", "applicant name"],
  legalName: ["legal name"],
  preferredName: ["preferred name", "preferred first name"],
  middleName: ["middle name"],
  email: ["email", "e mail"],
  phone: ["phone", "mobile", "telephone", "cell"],
  phoneType: ["phone type"],
  city: ["city"],
  state: ["state", "province"],
  country: ["country"],
  postalCode: ["postal code", "zip", "zip code"],
  address: ["street address", "mailing address", "home address", "street"],
  location: ["current location", "location"],
  linkedin: ["linkedin"],
  github: ["github"],
  website: ["website", "portfolio", "personal site"],
  twitter: ["twitter", "x com"],
  school: ["school", "university", "college"],
  degree: ["degree"],
  major: ["major", "discipline", "field of study"],
  highestDegree: ["highest degree", "level of education"],
  gradDate: ["graduation", "grad date", "expected graduation"],
  workAuthorization: ["authorized to work", "legally authorized", "work authorization"],
  needsSponsorship: ["sponsorship", "visa sponsorship", "require sponsorship"],
  willingToRelocate: ["relocate", "relocation"],
  startDate: ["start date", "available to start", "earliest start"],
  salaryExpectation: ["salary", "compensation expectation", "desired pay", "pay expect"],
  howDidYouHear: ["how did you hear", "source"],
  referredBy: ["referred by", "referral"],
  skills: ["skills"],
  language: ["language", "languages spoken"],
  currentCompany: ["current company", "current employer"],
};

/** Sensitive topics that must come from profile/saved answers only — never AI-guessed. */
export const PAUSE_TOPICS = [
  "salary",
  "compensation",
  "sponsor",
  "visa",
  "authorized",
  "authorization",
  "certif",
  "license",
  "attest",
  "gender",
  "race",
  "ethnic",
  "veteran",
  "disability",
  "criminal",
  "convicted",
  "ssn",
  "social security",
  "password",
  "bank",
];

export function needsPause(label: string): boolean {
  const t = label.toLowerCase();
  return PAUSE_TOPICS.some((topic) => t.includes(topic));
}

function phraseMatch(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(` ${text} `);
}

export function matchField(label: string): string | null {
  const text = label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let best: { key: string; len: number } | null = null;
  for (const [key, words] of Object.entries(FIELD_SYNONYMS)) {
    for (const w of words) {
      if (phraseMatch(text, w) && (!best || w.length > best.len)) best = { key, len: w.length };
    }
  }
  // Prefer fullName only when first/last didn't match and text is basically "name"
  if (best?.key === "fullName" && (text.includes("first") || text.includes("last"))) {
    return text.includes("first") ? "firstName" : "lastName";
  }
  return best?.key ?? null;
}
