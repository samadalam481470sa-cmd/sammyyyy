import { DEFAULT_SEARCH, expandTitles, isBlockedJobUrl, seedEmployers } from "./finder.js";
import { normalize, tokenSetRatio } from "./fuzzy.js";
import type { ApplyQueueItem } from "./applyLoop.js";
import type { EmployerRecord } from "./finder.js";

/**
 * Pull public ATS feeds for the built-in employer seed.
 * Runs in the extension so keep-applying does not need the 24/7 API.
 */
export async function fetchBuiltInJobQueue(limit = 60): Promise<ApplyQueueItem[]> {
  const settled = await Promise.all(
    seedEmployers().map((emp) => fetchBoardUrls(emp).catch(() => [] as ApplyQueueItem[]))
  );
  const items = settled.flat();
  const expanded = expandTitles(DEFAULT_SEARCH.titles);
  const niche = DEFAULT_SEARCH.nicheKeywords.map(normalize);
  const filtered = items.filter((j) => {
    if (!j.url || isBlockedJobUrl(j.url)) return false;
    const n = normalize(j.title);
    const titleHit = expanded.some((t) => n.includes(t) || tokenSetRatio(j.title, t) > 0.5);
    const nicheHit = niche.some((k) => n.includes(k) || normalize(j.company).includes(k));
    return titleHit || nicheHit;
  });
  const unique = uniqueJobs(filtered, limit);
  if (unique.length >= 8) return unique;
  return uniqueJobs(items, limit);
}

function uniqueJobs(list: ApplyQueueItem[], limit: number): ApplyQueueItem[] {
  const seen = new Set<string>();
  const unique: ApplyQueueItem[] = [];
  for (const j of list) {
    if (!j.url || isBlockedJobUrl(j.url) || seen.has(j.url)) continue;
    seen.add(j.url);
    unique.push(j);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function fetchOk(url: string): Promise<Response | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

async function fetchBoardUrls(employer: EmployerRecord): Promise<ApplyQueueItem[]> {
  if (!employer.slug || employer.board === "unknown") return [];
  if (employer.board === "greenhouse") {
    const r = await fetchOk(`https://boards-api.greenhouse.io/v1/boards/${employer.slug}/jobs`);
    if (!r) return [];
    const data = (await r.json()) as { jobs?: { title: string; absolute_url: string }[] };
    return (data.jobs || [])
      .filter((j) => j.absolute_url)
      .map((j) => ({ url: j.absolute_url, title: j.title, company: employer.company, source: "greenhouse" }));
  }
  if (employer.board === "lever") {
    const r = await fetchOk(`https://api.lever.co/v0/postings/${employer.slug}?mode=json`);
    if (!r) return [];
    const jobs = (await r.json()) as { text: string; hostedUrl: string }[];
    return jobs
      .filter((j) => j.hostedUrl)
      .map((j) => ({ url: j.hostedUrl, title: j.text, company: employer.company, source: "lever" }));
  }
  if (employer.board === "ashby") {
    const r = await fetchOk(`https://api.ashbyhq.com/posting-api/job-board/${employer.slug}`);
    if (!r) return [];
    const data = (await r.json()) as { jobs?: { title: string; jobUrl?: string }[] };
    return (data.jobs || [])
      .filter((j) => j.jobUrl)
      .map((j) => ({ url: j.jobUrl!, title: j.title, company: employer.company, source: "ashby" }));
  }
  if (employer.board === "smartrecruiters") {
    const r = await fetchOk(`https://api.smartrecruiters.com/v1/companies/${employer.slug}/postings`);
    if (!r) return [];
    const data = (await r.json()) as { content?: { id: string; name: string }[] };
    return (data.content || []).map((j) => ({
      url: `https://jobs.smartrecruiters.com/${employer.slug}/${j.id}`,
      title: j.name,
      company: employer.company,
      source: "smartrecruiters",
    }));
  }
  return [];
}
