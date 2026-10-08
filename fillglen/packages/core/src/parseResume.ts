import { EMPTY_PROFILE, type Profile } from "./types.js";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL = /https?:\/\/[^\s)]+/gi;

export function parseResumeText(text: string): Profile {
  const profile: Profile = structuredClone(EMPTY_PROFILE);
  profile.rawResumeText = text;
  const email = text.match(EMAIL)?.[0] || "";
  const phone = text.match(PHONE)?.[0] || "";
  const urls = text.match(URL) || [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  profile.contact.email = email;
  profile.contact.phone = phone.replace(/\s+/g, " ");
  profile.contact.legalName = lines[0]?.replace(email, "").replace(phone, "").trim().slice(0, 80) || "";
  profile.contact.linkedin = urls.find((u) => /linkedin/i.test(u)) || "";
  profile.contact.github = urls.find((u) => /github/i.test(u)) || "";
  profile.contact.portfolio = urls.find((u) => !/linkedin|github/i.test(u)) || "";
  const skillLine = lines.find((l) => /skills?\s*:/i.test(l));
  if (skillLine) {
    profile.skills = skillLine
      .split(/:|;/)[1]
      ?.split(/,|•|\|/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, category: "general", years: 0, level: "intermediate" as const })) ?? [];
  }
  return profile;
}
