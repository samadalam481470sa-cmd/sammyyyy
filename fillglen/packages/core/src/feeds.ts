import { titleRelevance } from "./answers.js";
import {
  DEFAULT_SEARCH,
  expandTitles,
  isBlockedJobUrl,
  isNonUsLocation,
  isTexasLocation,
  looksLikeItRole,
  seedEmployers,
} from "./finder.js";
import { normalize } from "./fuzzy.js";
import type { ApplyQueueItem } from "./applyLoop.js";
import type { EmployerRecord } from "./finder.js";
import { rankJobsForResume, resumeSearchHints } from "./resumeMatch.js";
import type { Profile } from "./types.js";

/**
 * Pull public ATS feeds for the built-in employer seed plus map-discovered companies.
 * Runs in the extension so keep-applying does not need the 24/7 API.
 */
export async function fetchBuiltInJobQueue(
  limit = 100,
  opts?: { profile?: Profile | null; extraEmployers?: EmployerRecord[] }
): Promise<ApplyQueueItem[]> {
  const hints = resumeSearchHints(opts?.profile);
  const settled = await Promise.all(
    seedEmployers(opts?.extraEmployers || []).map((emp) => fetchEmployerBoardJobs(emp).catch(() => [] as ApplyQueueItem[]))
  );
  const items = settled.flat();
  const expanded = expandTitles(hints.titles);
  const niche = hints.keywords.map(normalize);
  const filtered = items.filter((j) => {
    if (!j.url || isBlockedJobUrl(j.url)) return false;
    const loc = j.location || "";
    if (loc && isNonUsLocation(loc)) return false;
    const n = normalize(j.title);
    const titleHit = titleRelevance(j.title, [...hints.titles, ...expanded]) >= 0.45;
    const nicheHit = niche.some((k) => k.length > 2 && (n.includes(k) || normalize(j.company).includes(k)));
    return titleHit || nicheHit || looksLikeItRole(j.title);
  });
  const ranked = rankJobsForResume(filtered, opts?.profile);
  ranked.sort((a, b) => {
    const score = (b.score || 0) - (a.score || 0);
    if (score) return score;
    return preferTexasThenUs(a) - preferTexasThenUs(b);
  });
  return uniqueJobs(ranked, limit);
}

function preferTexasThenUs(j: ApplyQueueItem): number {
  const blob = `${j.location || ""} ${j.company}`;
  if (isTexasLocation(blob)) return 0;
  if (!j.location) return 1;
  return 2;
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

export async function fetchEmployerBoardJobs(employer: EmployerRecord): Promise<ApplyQueueItem[]> {
  if (!employer.slug || employer.board === "unknown") return [];
  if (employer.board === "greenhouse") {
    const r = await fetchOk(`https://boards-api.greenhouse.io/v1/boards/${employer.slug}/jobs`);
    if (!r) return [];
    const data = (await r.json()) as { jobs?: { title: string; absolute_url: string; location?: { name?: string } }[] };
    return (data.jobs || [])
      .filter((j) => j.absolute_url)
      .map((j) => ({
        url: j.absolute_url,
        title: j.title,
        company: employer.company,
        source: "greenhouse",
        location: j.location?.name,
      }));
  }
  if (employer.board === "lever") {
    const r = await fetchOk(`https://api.lever.co/v0/postings/${employer.slug}?mode=json`);
    if (!r) return [];
    const jobs = (await r.json()) as { text: string; hostedUrl: string; categories?: { location?: string } }[];
    return jobs
      .filter((j) => j.hostedUrl)
      .map((j) => ({
        url: j.hostedUrl,
        title: j.text,
        company: employer.company,
        source: "lever",
        location: j.categories?.location,
      }));
  }
  if (employer.board === "ashby") {
    const r = await fetchOk(`https://api.ashbyhq.com/posting-api/job-board/${employer.slug}`);
    if (!r) return [];
    const data = (await r.json()) as { jobs?: { title: string; jobUrl?: string; location?: string }[] };
    return (data.jobs || [])
      .filter((j) => j.jobUrl)
      .map((j) => ({
        url: j.jobUrl!,
        title: j.title,
        company: employer.company,
        source: "ashby",
        location: j.location,
      }));
  }
  if (employer.board === "smartrecruiters") {
    const r = await fetchOk(`https://api.smartrecruiters.com/v1/companies/${employer.slug}/postings`);
    if (!r) return [];
    const data = (await r.json()) as {
      content?: { id: string; name: string; location?: { city?: string; region?: string; country?: string } }[];
    };
    return (data.content || []).map((j) => ({
      url: `https://jobs.smartrecruiters.com/${employer.slug}/${j.id}`,
      title: j.name,
      company: employer.company,
      source: "smartrecruiters",
      location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", "),
    }));
  }
  if (employer.board === "workable") {
    const r = await fetchOk(`https://apply.workable.com/api/v1/widget/accounts/${employer.slug}`);
    if (!r) return [];
    const data = (await r.json()) as {
      jobs?: { title: string; url?: string; shortcode?: string; location?: { city?: string; country?: string } }[];
    };
    return (data.jobs || [])
      .filter((j) => j.url || j.shortcode)
      .map((j) => ({
        url: j.url || `https://apply.workable.com/${employer.slug}/j/${j.shortcode}/`,
        title: j.title,
        company: employer.company,
        source: "workable",
        location: [j.location?.city, j.location?.country].filter(Boolean).join(", "),
      }));
  }
  if (employer.board === "recruitee") {
    const r = await fetchOk(`https://${employer.slug}.recruitee.com/api/offers`);
    if (!r) return [];
    const data = (await r.json()) as {
      offers?: { title: string; careers_url?: string; location?: string }[];
    };
    return (data.offers || [])
      .filter((j) => j.careers_url)
      .map((j) => ({
        url: j.careers_url!,
        title: j.title,
        company: employer.company,
        source: "recruitee",
        location: j.location,
      }));
  }
  return [];
}
