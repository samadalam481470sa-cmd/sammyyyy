import { EMPTY_PROFILE, type Profile, type Skill, type WorkJob } from "./types.js";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL = /https?:\/\/[^\s)]+/gi;
const TITLE_WORD =
  /\b(engineer|developer|analyst|administrator|specialist|technician|architect|scientist|consultant|intern|sysadmin|help desk|it manager|software|systems|cybersecurity|network)\b/i;

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
  const loc = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*(TX|Texas|CA|NY|WA|IL|GA|CO|MA|FL|AZ|NC|VA)\b/);
  if (loc) {
    profile.contact.city = loc[1];
    profile.contact.state = loc[2] === "Texas" ? "TX" : loc[2];
  }
  profile.skills = extractSkills(text, lines);
  profile.work = extractWork(lines);
  return profile;
}

function extractSkills(text: string, lines: string[]): Skill[] {
  const names = new Set<string>();
  const skillLine = lines.find((l) => /skills?\s*:/i.test(l));
  if (skillLine) {
    skillLine
      .split(/:|;/)
      .slice(1)
      .join(":")
      .split(/,|•|\||;/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40)
      .forEach((name) => names.add(name));
  }
  const block = text.split(/\n(?=[A-Z][A-Za-z ]{2,20}\s*$)/);
  const skillsHead = block.find((b) => /^skills\b/i.test(b.trim()) || /\nskills\b/i.test(b));
  if (skillsHead) {
    skillsHead
      .split(/\n/)
      .slice(1)
      .join(" ")
      .split(/,|•|\||;/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40 && !/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s))
      .forEach((name) => names.add(name));
  }
  return [...names].slice(0, 32).map((name) => ({ name, category: "general", years: 0, level: "intermediate" as const }));
}

function extractWork(lines: string[]): WorkJob[] {
  const jobs: WorkJob[] = [];
  for (const line of lines) {
    if (!TITLE_WORD.test(line) || line.length > 90) continue;
    if (/skills|education|summary|objective|certification/i.test(line)) continue;
    const cleaned = line.replace(EMAIL, "").trim();
    const parts = cleaned.split(/\s+[–—|-]\s+|\s+at\s+/i);
    const title = (parts[0] || cleaned).slice(0, 80);
    const company = (parts[1] || "").slice(0, 80);
    if (jobs.some((j) => j.title === title && j.company === company)) continue;
    jobs.push({
      id: `w${jobs.length + 1}`,
      company,
      title,
      startDate: "",
      endDate: "",
      location: "",
      bullets: [],
    });
    if (jobs.length >= 6) break;
  }
  return jobs;
}
