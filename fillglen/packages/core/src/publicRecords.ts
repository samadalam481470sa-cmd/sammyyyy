import {
  detectBoardFromCareersUrl,
  isBlockedJobUrl,
  type EmployerRecord,
} from "./finder.js";
import { normalize } from "./fuzzy.js";
import {
  extractCareerLinks,
  inspectCompanyCareers,
  normalizeWebsite,
  type MapCompany,
} from "./mapsDiscover.js";
import { fetchPage, govDirectories, GOV_USER_AGENT, looksLikeBogusJob } from "./govJobs.js";
import type { ApplyQueueItem } from "./applyLoop.js";

export interface FilingHit {
  company: string;
  ticker?: string;
  filed?: string;
  url: string;
  form?: string;
}

export function companySlugGuesses(company: string): string[] {
  const n = normalize(company)
    .replace(/\b(inc|incorporated|llc|ltd|corp|corporation|co|company|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!n) return [];
  const compact = n.replace(/\s+/g, "");
  const dashed = n.replace(/\s+/g, "-");
  const first = n.split(" ")[0];
  return [...new Set([compact, dashed, first].filter((s) => s.length >= 3))].slice(0, 2);
}

export function cleanFilingCompany(name: string): string {
  return name
    .replace(/\s*\(CIK\s*\d+\)/gi, "")
    .replace(/\s*\([A-Z0-9]{1,6}(?:,\s*[A-Z0-9]{1,6})*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseSecSearchHits(raw: unknown): FilingHit[] {
  const hits =
    (raw as { hits?: { hits?: { _id?: string; _source?: Record<string, unknown> }[] } })?.hits?.hits || [];
  const out: FilingHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const src = hit._source || {};
    const names = [
      ...(Array.isArray(src.display_names) ? src.display_names : []),
      src.entity_name,
      src.display_name,
    ]
      .map((n) => String(n || "").trim())
      .filter(Boolean);
    const company = cleanFilingCompany(names[0]);
    if (!company) continue;
    const ticker = Array.isArray(src.tickers) ? String(src.tickers[0] || "") : String(src.tickers || "");
    const filed = String(src.file_date || src.period_ending || "");
    const form = String(src.form_type || src.file_type || "8-K");
    const cik = Array.isArray(src.ciks) ? String(src.ciks[0] || "") : String(src.ciks || "");
    const accession = String(hit._id || "").split(":")[0];
    const url = cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cik)}&type=${encodeURIComponent(form)}&count=5`
      : `https://www.sec.gov/`;
    const key = normalize(company);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ company, ticker, filed, url, form });
    if (accession && out.length) out[out.length - 1].url = url;
  }
  return out.slice(0, 20);
}

export function parseUsaSpendingAwards(raw: unknown): { company: string }[] {
  const rows = (raw as { results?: Record<string, unknown>[] })?.results || [];
  const seen = new Set<string>();
  const out: { company: string }[] = [];
  for (const row of rows) {
    const company = String(
      row["Recipient Name"] || row.recipient_name || row.RecipientName || ""
    ).trim();
    const key = normalize(company);
    if (!company || seen.has(key)) continue;
    seen.add(key);
    out.push({ company });
  }
  return out.slice(0, 20);
}

export function parseDirectoryCompanies(html: string, pageUrl: string, metro: string): MapCompany[] {
  const hrefs = extractCareerLinks(html, pageUrl);
  const extra = [...html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]);
  const names = [...html.matchAll(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]{2,80}?)<\/a>/gi)];
  const out: MapCompany[] = [];
  const seen = new Set<string>();
  for (const m of names) {
    const website = normalizeWebsite(m[1]);
    const name = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!website || !name || isBlockedJobUrl(website)) continue;
    if (/privacy|terms|facebook|twitter|linkedin|instagram|youtube|mailto/i.test(website)) continue;
    if (name.length < 3 || name.length > 80) continue;
    const key = `${normalize(name)}|${website}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      website,
      lat: 32.78,
      lng: -96.8,
      city: metro,
      tags: ["economic-development"],
      source: "openstreetmap",
      metro,
    });
  }
  for (const href of [...hrefs, ...extra].slice(0, 20)) {
    const website = normalizeWebsite(href);
    if (!website || seen.has(website) || isBlockedJobUrl(website)) continue;
  }
  return out.slice(0, 24);
}

export function atsProbeUrls(slug: string): { board: string; slug: string; jobsUrl: string; careersUrl: string }[] {
  return [
    {
      board: "greenhouse",
      slug,
      jobsUrl: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
      careersUrl: `https://boards.greenhouse.io/${slug}`,
    },
    {
      board: "lever",
      slug,
      jobsUrl: `https://api.lever.co/v0/postings/${slug}?mode=json`,
      careersUrl: `https://jobs.lever.co/${slug}`,
    },
    {
      board: "ashby",
      slug,
      jobsUrl: `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
      careersUrl: `https://jobs.ashbyhq.com/${slug}`,
    },
  ];
}

export function jobsFromAtsJson(board: string, company: string, json: unknown): ApplyQueueItem[] {
  if (board === "greenhouse") {
    const jobs = (json as { jobs?: { title: string; absolute_url: string; location?: { name?: string } }[] }).jobs || [];
    return jobs
      .filter((j) => j.absolute_url && j.title)
      .map((j) => ({
        url: j.absolute_url,
        title: j.title,
        company,
        source: "greenhouse",
        location: j.location?.name,
      }));
  }
  if (board === "lever") {
    const jobs = (json as { text: string; hostedUrl: string; categories?: { location?: string } }[]) || [];
    if (!Array.isArray(jobs)) return [];
    return jobs
      .filter((j) => j.hostedUrl && j.text)
      .map((j) => ({
        url: j.hostedUrl,
        title: j.text,
        company,
        source: "lever",
        location: j.categories?.location,
      }));
  }
  if (board === "ashby") {
    const jobs = (json as { jobs?: { title: string; jobUrl?: string; location?: string }[] }).jobs || [];
    return jobs
      .filter((j) => j.jobUrl && j.title)
      .map((j) => ({
        url: j.jobUrl!,
        title: j.title,
        company,
        source: "ashby",
        location: j.location,
      }));
  }
  return [];
}

export async function probeCompanyAts(company: string): Promise<{ jobs: ApplyQueueItem[]; employer?: EmployerRecord }> {
  const slugs = companySlugGuesses(company);
  for (const slug of slugs) {
    for (const probe of atsProbeUrls(slug)) {
      const page = await fetchPage(probe.jobsUrl, { timeoutMs: 6000 });
      if (!page.ok || !page.json) continue;
      const jobs = jobsFromAtsJson(probe.board, company, page.json).filter((j) => !looksLikeBogusJob(j));
      if (!jobs.length) continue;
      const detected = detectBoardFromCareersUrl(probe.careersUrl);
      return {
        jobs,
        employer: {
          company,
          metro: "texas",
          careersUrl: probe.careersUrl,
          board: detected?.board || probe.board,
          slug: detected?.slug || slug,
          sourceKind: "sec-filings",
          hqHint: "United States",
        },
      };
    }
  }
  return { jobs: [] };
}

export async function fetchSecHiringFilings(): Promise<FilingHit[]> {
  const end = new Date();
  const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45);
  const startdt = start.toISOString().slice(0, 10);
  const enddt = end.toISOString().slice(0, 10);
  const q = encodeURIComponent('"we are hiring" OR "now hiring" OR "open positions" OR "expanding our team"');
  const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&forms=8-K&dateRange=custom&startdt=${startdt}&enddt=${enddt}`;
  const page = await fetchPage(url, {
    timeoutMs: 10000,
    headers: { "User-Agent": GOV_USER_AGENT, Accept: "application/json" },
  });
  if (!page.json) return [];
  return parseSecSearchHits(page.json);
}

export async function fetchTexasItContractors(): Promise<{ company: string }[]> {
  try {
    const r = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "content-type": "application/json", "User-Agent": GOV_USER_AGENT },
      body: JSON.stringify({
        filters: {
          award_type_codes: ["A", "B", "C", "D"],
          naics_codes: ["541511", "541512", "541513", "541519"],
          place_of_performance_locations: [{ country: "USA", state: "TX" }],
          time_period: [{ start_date: "2025-01-01", end_date: new Date().toISOString().slice(0, 10) }],
        },
        fields: ["Award ID", "Recipient Name", "NAICS", "Award Amount"],
        limit: 20,
        page: 1,
      }),
    });
    if (!r.ok) return [];
    const json = await r.json();
    return parseUsaSpendingAwards(json);
  } catch {
    return [];
  }
}

export async function discoverDirectoryEmployers(
  fetchHtml: (url: string) => Promise<string | null>
): Promise<EmployerRecord[]> {
  const dirs = govDirectories();
  const out: EmployerRecord[] = [];
  for (const dir of dirs.slice(0, 4)) {
    const html = await fetchHtml(dir.url);
    if (!html) continue;
    const companies = parseDirectoryCompanies(html, dir.url, dir.metro);
    for (const co of companies.slice(0, 5)) {
      const rec = await inspectCompanyCareers(co, fetchHtml).catch(() => null);
      if (rec) out.push({ ...rec, sourceKind: rec.sourceKind || "gov-directory" });
    }
  }
  return out;
}

export async function jobsFromPublicRecords(limit = 40): Promise<{ jobs: ApplyQueueItem[]; employers: EmployerRecord[] }> {
  const jobs: ApplyQueueItem[] = [];
  const employers: EmployerRecord[] = [];
  const seenCo = new Set<string>();
  const filings = await fetchSecHiringFilings().catch(() => []);
  const contractors = await fetchTexasItContractors().catch(() => []);
  const companies = [
    ...filings.map((f) => f.company),
    ...contractors.map((c) => c.company),
  ];
  let attempts = 0;
  for (const company of companies) {
    const key = normalize(company);
    if (!key || seenCo.has(key)) continue;
    seenCo.add(key);
    if (attempts >= 3 || jobs.length >= limit) break;
    attempts += 1;
    const probed = await probeCompanyAts(company).catch(
      (): { jobs: ApplyQueueItem[]; employer?: EmployerRecord } => ({ jobs: [] })
    );
    if (probed.employer) employers.push(probed.employer);
    jobs.push(...probed.jobs);
  }
  return { jobs: jobs.slice(0, limit), employers };
}
