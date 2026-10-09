import { titleRelevance } from "./answers.js";
import type { ApplyQueueItem } from "./applyLoop.js";
import {
  DEFAULT_SEARCH,
  expandTitles,
  isTexasLocation,
  looksLikeItRole,
  type SearchSettings,
} from "./finder.js";
import { jobComplexityBoost } from "./applicationShape.js";
import { normalize } from "./fuzzy.js";
import type { Profile } from "./types.js";

export function resumeSearchHints(profile?: Profile | null): { titles: string[]; skills: string[]; keywords: string[] } {
  if (!profile) return { titles: [...DEFAULT_SEARCH.titles], skills: [], keywords: [...DEFAULT_SEARCH.nicheKeywords] };
  const titles = [
    ...profile.work.map((w) => w.title).filter(Boolean),
    ...titlesFromResumeText(profile.rawResumeText),
  ];
  const skills = profile.skills.map((s) => s.name).filter(Boolean);
  const uniqTitles = uniqueKeep([
    ...titles.map((t) => t.trim()).filter((t) => t.length > 2),
    ...DEFAULT_SEARCH.titles,
  ]);
  const keywords = uniqueKeep([...skills, ...DEFAULT_SEARCH.nicheKeywords]);
  return { titles: uniqTitles.slice(0, 16), skills: skills.slice(0, 24), keywords: keywords.slice(0, 24) };
}

function titlesFromResumeText(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) =>
      /\b(engineer|developer|analyst|administrator|specialist|technician|architect|scientist|sysadmin|help desk|support specialist|it manager)\b/i.test(
        l
      )
    )
    .map((l) => l.replace(/\s+[–—|-]\s+.*$/, "").slice(0, 80))
    .filter((l) => l.length < 70);
}

function uniqueKeep(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = normalize(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function settingsFromResume(profile: Profile | null | undefined, base: SearchSettings = DEFAULT_SEARCH): SearchSettings {
  const hints = resumeSearchHints(profile);
  return {
    ...base,
    titles: hints.titles.length ? hints.titles : base.titles,
    nicheKeywords: hints.keywords.length ? hints.keywords : base.nicheKeywords,
  };
}

/** Rank sourced jobs against the pasted resume. Texas IT still gets a boost. */
export function rankJobsForResume(jobs: ApplyQueueItem[], profile?: Profile | null): ApplyQueueItem[] {
  const hints = resumeSearchHints(profile);
  const expanded = expandTitles(hints.titles);
  const resume = normalize(
    [profile?.rawResumeText, ...(profile?.skills || []).map((s) => s.name), ...(profile?.work || []).map((w) => w.title)].join(
      " "
    )
  );
  const scored = jobs.map((j) => {
    const titleScore = titleRelevance(j.title, [...hints.titles, ...expanded]);
    const blob = normalize(`${j.title} ${j.company} ${j.location || ""}`);
    const skillHits = hints.skills.filter((s) => {
      const n = normalize(s);
      return n.length > 1 && blob.includes(n);
    });
    const resumeHit = resume
      ? tokensOverlap(resume, blob)
      : 0;
    let score = Math.round(titleScore * 55);
    score += Math.min(22, skillHits.length * 7);
    score += Math.round(resumeHit * 12);
    if (looksLikeItRole(j.title)) score += 6;
    if (isTexasLocation(`${j.location || ""} ${j.company}`)) score += 15;
    const complex = jobComplexityBoost(j.url, j.title, j.source);
    score += complex.boost;
    score = Math.max(0, Math.min(100, score));
    const why = titleScore >= 0.5
      ? `Fits your resume title${skillHits[0] ? ` and ${skillHits[0]}` : ""}${isTexasLocation(j.location || "") ? " · Texas" : ""} · ${complex.why}.`
      : `Nearby IT role${isTexasLocation(j.location || "") ? " in Texas" : ""} · ${complex.why}.`;
    return { ...j, score, why };
  });
  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scored;
}

function tokensOverlap(resume: string, job: string): number {
  const a = new Set(resume.split(/\s+/).filter((t) => t.length > 3));
  const b = job.split(/\s+/).filter((t) => t.length > 3);
  if (!b.length) return 0;
  let n = 0;
  for (const t of b) if (a.has(t)) n += 1;
  return Math.min(1, n / Math.min(8, b.length));
}
