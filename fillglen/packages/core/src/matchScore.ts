import synonyms from "../data/skills-synonyms.json" with { type: "json" };
import { normalize, tokens } from "./fuzzy.js";
import type { MatchBreakdown, Profile } from "./types.js";

const STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "you",
  "your",
  "our",
  "will",
  "are",
  "this",
  "that",
  "from",
  "have",
  "has",
  "not",
  "job",
  "role",
  "team",
  "work",
  "ability",
  "experience",
  "years",
  "plus",
  "including",
]);

function expand(term: string): string[] {
  const n = normalize(term);
  const extra = (synonyms as Record<string, string[]>)[n] || [];
  const reverse = Object.entries(synonyms as Record<string, string[]>).filter(([, list]) =>
    list.map(normalize).includes(n)
  );
  return [n, ...extra.map(normalize), ...reverse.map(([k]) => k)];
}

function resumeBlob(profile: Profile): string {
  const parts = [
    profile.rawResumeText,
    profile.contact.legalName,
    ...profile.skills.map((s) => s.name),
    ...profile.work.flatMap((w) => [w.title, w.company, ...w.bullets.map((b) => b.text)]),
  ];
  return normalize(parts.join(" "));
}

export function extractKeywords(description: string): { required: string[]; preferred: string[] } {
  const lines = description.split(/\n+/);
  const required: string[] = [];
  const preferred: string[] = [];
  for (const line of lines) {
    const n = normalize(line);
    const bucket = /preferred|nice to have|bonus/.test(n) ? preferred : required;
    if (!/(required|must|qualif|preferred|nice to have|skills|experience)/.test(n) && line.length > 80) continue;
    for (const t of tokens(line)) {
      if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t)) continue;
      bucket.push(t);
    }
  }
  const uniq = (arr: string[]) => [...new Set(arr)].slice(0, 24);
  if (required.length === 0) {
    return { required: uniq(tokens(description).filter((t) => t.length > 3 && !STOP.has(t))), preferred: [] };
  }
  return { required: uniq(required), preferred: uniq(preferred) };
}

export function scoreMatch(description: string, profile: Profile, knownSkills: string[] = []): MatchBreakdown {
  const { required, preferred } = extractKeywords(description);
  const blob = resumeBlob(profile);
  const skillNames = profile.skills.map((s) => normalize(s.name));

  const matched: string[] = [];
  const missing: string[] = [];
  let points = 0;
  let total = 0;

  function consider(term: string, weight: number) {
    total += weight;
    const variants = expand(term);
    if (variants.some((v) => blob.includes(v))) {
      matched.push(term);
      points += weight;
    } else {
      missing.push(term);
    }
  }

  for (const t of required) consider(t, 3);
  for (const t of preferred) consider(t, 1);

  const haveButNotOnResume = knownSkills
    .map(normalize)
    .filter((s) => skillNames.includes(s) === false && blob.includes(s) === false)
    .slice(0, 8);

  const score = total === 0 ? 0 : Math.round((points / total) * 100);
  return {
    score,
    matched: [...new Set(matched)],
    missing: [...new Set(missing)].filter((m) => !matched.includes(m)),
    haveButNotOnResume,
    explanation:
      "This score is keyword overlap between the posting and your profile. It is not a prediction of whether any company's ATS will pass your resume — no tool can know that.",
  };
}
