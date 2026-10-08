import { normalize, tokenSetRatio } from "./fuzzy.js";
import type { Profile, WorkJob } from "./types.js";

export interface TailorChange {
  original: string;
  proposed: string;
  reason: string;
  accepted?: boolean;
}

export interface TailorResult {
  bullets: TailorChange[];
  missingSkills: string[];
  rejectedInventions: string[];
}

function hasSkill(profile: Profile, term: string): boolean {
  const n = normalize(term);
  if (profile.skills.some((s) => normalize(s.name).includes(n) || n.includes(normalize(s.name)))) return true;
  return normalize(profile.rawResumeText).includes(n);
}

export function tailorResume(
  profile: Profile,
  jobDescription: string,
  extractedRequirements: string[]
): TailorResult {
  const allBullets = profile.work.flatMap((job: WorkJob) =>
    job.bullets.map((b) => ({ text: b.text, tags: b.tags, job }))
  );
  const scored = allBullets
    .map((b) => ({
      ...b,
      score: Math.max(...extractedRequirements.map((r) => tokenSetRatio(b.text + " " + b.tags.join(" "), r)), 0),
    }))
    .sort((a, b) => b.score - a.score);

  const bullets: TailorChange[] = scored.slice(0, 12).map((b) => {
    const hit = extractedRequirements.find((r) => tokenSetRatio(b.text, r) > 0.3);
    if (hit && hasSkill(profile, hit) && !normalize(b.text).includes(normalize(hit))) {
      return {
        original: b.text,
        proposed: `${b.text.replace(/\.$/, "")} (${hit}).`,
        reason: `Uses the posting's wording for a skill you already listed: ${hit}.`,
      };
    }
    return {
      original: b.text,
      proposed: b.text,
      reason: "Kept as written; already a strong match or no safe rephrase.",
    };
  });

  const missingSkills = extractedRequirements.filter((r) => !hasSkill(profile, r));
  return { bullets, missingSkills, rejectedInventions: missingSkills.map((s) => `Did not add "${s}" — not on your profile.`) };
}
