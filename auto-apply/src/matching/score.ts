import { configPath, readJson } from "../paths";
import type { Job } from "../discovery/types";

export type Rules = {
  titleInclude: string[];
  titleExclude: string[];
  locations: string[];
  keywords: string[];
  minScore: number;
  dailyCap: number;
  maxPerCompanyPerWeek: number;
  minutesBetweenApplications: number;
  dryRun: boolean;
};

export function loadRules(): Rules {
  return readJson<Rules>(configPath("rules.json"));
}

export function scoreJob(job: Job, rules: Rules = loadRules()): number {
  const title = job.title.toLowerCase();
  const loc = job.location.toLowerCase();
  const desc = job.description.toLowerCase();

  if (rules.titleExclude.some((w) => title.includes(w.toLowerCase()))) return 0;
  if (rules.titleInclude.length > 0 && !rules.titleInclude.some((w) => title.includes(w.toLowerCase()))) {
    return 0;
  }
  // Allow empty location; otherwise require a location match.
  if (loc && rules.locations.length > 0 && !rules.locations.some((w) => loc.includes(w.toLowerCase()))) {
    // Still allow if description strongly signals remote/US and rules include remote
    const remoteOk =
      rules.locations.some((w) => w.toLowerCase() === "remote") && /remote/.test(`${loc} ${desc.slice(0, 400)}`);
    if (!remoteOk) return 0;
  }

  let score = 2; // passed title (+ location when present)
  for (const k of rules.keywords) if (desc.includes(k.toLowerCase())) score += 1;
  return score;
}
