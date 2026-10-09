import { canonicalJobUrl, type ApplyQueueItem } from "./applyLoop.js";
import { looksLikeItRole, type EmployerRecord } from "./finder.js";
import {
  fetchAllGovernmentJobs,
  looksLikeBogusJob,
  looksLikeGovItRole,
} from "./govJobs.js";
import { jobsFromPublicRecords } from "./publicRecords.js";

/**
 * Extra auto-search layer: local government boards, USAJOBS, SEC hiring filings,
 * and federal IT contractor awards. Never invents postings. Failures return [].
 */
export async function fetchDeepSearchJobs(
  limit = 80
): Promise<{ jobs: ApplyQueueItem[]; employers: EmployerRecord[]; gov: number; records: number }> {
  const gov = await fetchAllGovernmentJobs().catch(() => [] as ApplyQueueItem[]);
  const records = await jobsFromPublicRecords(Math.max(20, Math.floor(limit / 2))).catch(() => ({
    jobs: [] as ApplyQueueItem[],
    employers: [] as EmployerRecord[],
  }));
  const merged = uniqueSolidJobs([...gov, ...records.jobs], limit);
  return {
    jobs: merged,
    employers: records.employers,
    gov: gov.length,
    records: records.jobs.length,
  };
}

export function uniqueSolidJobs(list: ApplyQueueItem[], limit: number): ApplyQueueItem[] {
  const seen = new Set<string>();
  const unique: ApplyQueueItem[] = [];
  for (const j of list) {
    if (!j?.url || looksLikeBogusJob(j)) continue;
    if (!looksLikeGovItRole(j.title) && !looksLikeItRole(j.title)) continue;
    const key = canonicalJobUrl(j.url) || j.url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...j,
      why: j.why || solidWhy(j),
    });
    if (unique.length >= limit) break;
  }
  return unique;
}

function solidWhy(j: ApplyQueueItem): string {
  if (j.source === "governmentjobs" || j.source === "usajobs") {
    return "Posted on a public government career board, not a third-party listing mill.";
  }
  if (j.source === "greenhouse" || j.source === "lever" || j.source === "ashby") {
    return "Company showed up in public filings or federal IT awards, then a live ATS feed confirmed the role.";
  }
  return "Sourced from the extra government and public-records search layer.";
}
