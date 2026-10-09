import { fetchEmployerBoardJobs, isBlockedJobUrl, isNonUsLocation, isTexasLocation, looksLikeItRole, seedEmployers, titleRelevance, DEFAULT_SEARCH, expandTitles } from "@fillglen/core";

export interface PublicJob {
  id: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  board: string;
  postedAt: string;
  description: string;
}

export async function fetchPublicJobs(filter: { q: string; location: string; remote: string }): Promise<PublicJob[]> {
  const employers = seedEmployers().filter((e) => e.slug && e.board !== "unknown");
  const settled = await Promise.all(
    employers.map(async (c) => {
      try {
        return await fetchEmployerBoardJobs(c);
      } catch {
        return [];
      }
    })
  );
  const expanded = expandTitles(DEFAULT_SEARCH.titles);
  const out: PublicJob[] = [];
  for (const jobs of settled) {
    for (const job of jobs) {
      if (!job.url || isBlockedJobUrl(job.url)) continue;
      const loc = job.location || "";
      if (loc && isNonUsLocation(loc)) continue;
      const titleHit = titleRelevance(job.title, [...DEFAULT_SEARCH.titles, ...expanded]) >= 0.5;
      if (!titleHit && !looksLikeItRole(job.title)) continue;
      out.push({
        id: `${job.source || "job"}-${hashUrl(job.url)}`,
        company: job.company,
        title: job.title,
        location: loc,
        remote: /remote/i.test(`${loc} ${job.title}`),
        url: job.url,
        board: job.source || "",
        postedAt: "",
        description: "",
      });
    }
  }
  out.sort((a, b) => {
    const at = isTexasLocation(`${a.location} ${a.company}`) ? 1 : 0;
    const bt = isTexasLocation(`${b.location} ${b.company}`) ? 1 : 0;
    return bt - at;
  });
  return out.filter((j) => {
    if (filter.q && !`${j.title} ${j.company}`.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if (filter.location && !j.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
    if (filter.remote === "true" && !j.remote) return false;
    return true;
  });
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export const COMPANY_SEED = seedEmployers();
