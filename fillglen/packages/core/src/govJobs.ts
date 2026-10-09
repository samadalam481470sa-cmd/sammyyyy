import govSeed from "../data/gov-employers.json" with { type: "json" };
import { canonicalJobUrl, type ApplyQueueItem } from "./applyLoop.js";
import {
  assertRealListing,
  classifyWorkMode,
  geocodeLocation,
  isBlockedJobUrl,
  looksLikeItRole,
  remoteWhereText,
  type CanonicalListing,
  type EmployerRecord,
} from "./finder.js";
import { normalize } from "./fuzzy.js";

export const GOV_USER_AGENT = "Fillglen/0.1 (public job research; +https://fillglen.local)";

export interface GovBoardSeed extends EmployerRecord {
  kind?: string;
}

export interface GovDirectory {
  name: string;
  url: string;
  metro: string;
}

export function govEmployerSeed(): EmployerRecord[] {
  return ((govSeed as { jobBoards?: GovBoardSeed[] }).jobBoards || []).map((row) => ({
    company: row.company,
    metro: row.metro,
    careersUrl: row.careersUrl,
    board: row.board,
    slug: row.slug,
    sourceKind: row.sourceKind || "city-government",
    hqHint: row.hqHint,
  }));
}

export function govDirectories(): GovDirectory[] {
  return ((govSeed as { directories?: GovDirectory[] }).directories || []).filter((d) => d.url && d.name);
}

export function looksLikeBogusJob(job: Pick<ApplyQueueItem, "title" | "company" | "url" | "location">): boolean {
  if (!job.url || !job.title || !job.company) return true;
  if (isBlockedJobUrl(job.url)) return true;
  let host = "";
  try {
    const u = new URL(job.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return true;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return true;
  }
  const blob = `${job.title} ${job.company} ${job.url} ${job.location || ""}`.toLowerCase();
  if (/confidential|undisclosed company|hiring immediately!!!/.test(blob)) return true;
  if (/wire money|pay a fee|training fee|whatsapp|telegram\.me|t\.me\/|crypto pump|weekly pay.*no experience/.test(blob)) return true;
  if (/make \$?\d+ a day|work from phone|task rabbit|survey taker|data entry from home/.test(blob)) return true;
  if (/gmail\.com|yahoo\.com|outlook\.com|hotmail\.com/.test(host)) return true;
  if (/^mailto:|^javascript:/i.test(job.url)) return true;
  if (normalize(job.company).length < 2) return true;
  if (normalize(job.title).length < 4) return true;
  return false;
}

export function queueItemToListing(j: ApplyQueueItem, metro = "texas"): CanonicalListing {
  const now = new Date().toISOString();
  const geo = geocodeLocation(j.location || "", metro);
  const listing: CanonicalListing = {
    id: `${j.source || "gov"}-${canonicalJobUrl(j.url) || j.url}`.slice(0, 180),
    title: j.title,
    company: j.company,
    locationText: j.location || "",
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    workMode: classifyWorkMode(j.title, j.location || "", j.why || ""),
    remoteWhere: remoteWhereText(j.location || "", j.why || ""),
    description: j.why || "",
    url: j.url,
    source: j.source || "career-page",
    sources: [{ source: j.source || "career-page", url: j.url }],
    firstSeenAt: now,
    lastCheckedAt: now,
    status: "open",
  };
  assertRealListing(listing);
  return listing;
}

export function looksLikeGovItRole(title: string): boolean {
  if (looksLikeItRole(title)) return true;
  return /\b(it specialist|information technology specialist|computer scientist|applications developer|gis analyst|technology analyst|cybersecurity specialist|network administrator|systems support|computer operator|telecommunications|records systems|digital services)\b/i.test(
    title
  );
}

export function parseJobPostingLd(html: string, companyFallback: string, source: string): ApplyQueueItem[] {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const out: ApplyQueueItem[] = [];
  for (const block of blocks) {
    try {
      const raw = JSON.parse(block[1]);
      const nodes = Array.isArray(raw) ? raw : raw["@graph"] ? raw["@graph"] : [raw];
      for (const node of nodes) {
        const rows = flattenJobPostings(node);
        for (const job of rows) {
          const org = job.hiringOrganization;
          const orgName =
            org && typeof org === "object" ? String((org as JsonLd).name || "") : String(org || "");
          const title = String(job.title || job.name || "").trim();
          const url = String(job.url || job.applicationUrl || "").trim();
          const company = (orgName || companyFallback).trim() || companyFallback;
          const location = locationFromLd(job);
          if (!title || !url) continue;
          out.push({ url, title, company, source, location });
        }
      }
    } catch {
      /* ignore broken ld+json */
    }
  }
  return out;
}

type JsonLd = Record<string, unknown>;

function flattenJobPostings(node: JsonLd | undefined): JsonLd[] {
  if (!node || typeof node !== "object") return [];
  const type = String(node["@type"] || "");
  if (/jobposting/i.test(type)) return [node];
  if (Array.isArray(node.itemListElement)) {
    return (node.itemListElement as JsonLd[]).flatMap((el) => flattenJobPostings((el.item as JsonLd) || el));
  }
  return [];
}

function locationFromLd(job: JsonLd): string {
  const loc = job.jobLocation;
  const rows = Array.isArray(loc) ? loc : loc ? [loc] : [];
  const parts: string[] = [];
  for (const row of rows as JsonLd[]) {
    const addr = ((row.address as JsonLd) || row) as JsonLd;
    const city = String(addr.addressLocality || "");
    const region = String(addr.addressRegion || "");
    const country = String(addr.addressCountry || "");
    const line = [city, region, country].filter(Boolean).join(", ");
    if (line) parts.push(line);
  }
  return parts[0] || "";
}

export function parseGovernmentJobsHtml(html: string, agencySlug: string, company: string): ApplyQueueItem[] {
  const fromLd = parseJobPostingLd(html, company, "governmentjobs");
  const seen = new Set(fromLd.map((j) => j.url.split("?")[0]));
  const out = [...fromLd];
  const re = new RegExp(
    `href=["']((?:https://www\\.governmentjobs\\.com)?/careers/${escapeRe(agencySlug)}/jobs/(\\d+)[^"']*)["'][^>]*>([\\s\\S]*?)</a>`,
    "gi"
  );
  for (const m of html.matchAll(re)) {
    const path = m[1].startsWith("http") ? m[1] : `https://www.governmentjobs.com${m[1]}`;
    const url = path.split("&")[0];
    const title = stripTags(m[3]);
    if (!title || seen.has(url.split("?")[0])) continue;
    seen.add(url.split("?")[0]);
    out.push({ url, title, company, source: "governmentjobs", location: "Texas, United States" });
  }
  return out.filter((j) => !looksLikeBogusJob(j) && looksLikeGovItRole(j.title));
}

export function parseUsaJobsSearchHtml(html: string): ApplyQueueItem[] {
  const out: ApplyQueueItem[] = [];
  const seen = new Set<string>();
  const re = /href=["'](https:\/\/www\.usajobs\.gov\/job\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const url = m[1].split("?")[0];
    if (seen.has(url)) continue;
    seen.add(url);
    const title = stripTags(m[3]);
    if (!title) continue;
    out.push({
      url,
      title,
      company: "USAJOBS",
      source: "usajobs",
      location: "United States",
    });
  }
  const org = [...html.matchAll(/usajobs-search-result--department[^>]*>([\s\S]*?)</gi)].map((m) => stripTags(m[1]));
  if (org.length) {
    out.forEach((job, i) => {
      if (org[i]) job.company = org[i];
    });
  }
  return out.filter((j) => !looksLikeBogusJob(j) && looksLikeGovItRole(j.title));
}

export function parseUsaJobsApi(raw: unknown): ApplyQueueItem[] {
  const data = raw as {
    SearchResult?: { SearchResultItems?: { MatchedObjectDescriptor?: Record<string, string | undefined> }[] };
  };
  const items = data?.SearchResult?.SearchResultItems || [];
  return items
    .map((item) => item.MatchedObjectDescriptor)
    .filter(Boolean)
    .map((d) => ({
      url: String(d!.PositionURI || ""),
      title: String(d!.PositionTitle || ""),
      company: String(d!.OrganizationName || "USAJOBS"),
      source: "usajobs",
      location: String(d!.PositionLocationDisplay || "United States"),
    }))
    .filter((j) => j.url && j.title && !looksLikeBogusJob(j) && looksLikeGovItRole(j.title));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function fetchPage(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<{ ok: boolean; status: number; text: string; json?: unknown }> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 8000),
      redirect: "follow",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": GOV_USER_AGENT,
        ...(opts?.headers || {}),
      },
    });
    const text = await r.text();
    let json: unknown;
    const ct = r.headers.get("content-type") || "";
    if (/json/i.test(ct) || /^\s*[{[]/.test(text)) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return { ok: r.ok, status: r.status, text: text.slice(0, 400_000), json };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

export async function fetchGovernmentJobsBoard(employer: EmployerRecord): Promise<ApplyQueueItem[]> {
  if (employer.board !== "governmentjobs" || !employer.slug) return [];
  const slug = employer.slug;
  const pages = [
    `https://www.governmentjobs.com/careers/${slug}`,
    `https://www.governmentjobs.com/careers/${slug}?sort=PostingDate%7CDescending&page=1`,
  ];
  for (const url of pages) {
    const page = await fetchPage(url, { timeoutMs: 6000 });
    if (!page.text) continue;
    const jobs = parseGovernmentJobsHtml(page.text, slug, employer.company);
    if (jobs.length) return jobs;
    if (page.ok) break;
  }
  return [];
}

export async function fetchUsaJobsPublic(keywords: string, location: string): Promise<ApplyQueueItem[]> {
  const key = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.USAJOBS_API_KEY;
  const email = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.USAJOBS_EMAIL;
  if (key && email) {
    const api = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(keywords)}&LocationName=${encodeURIComponent(location)}&ResultsPerPage=25`;
    const page = await fetchPage(api, {
      headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key },
    });
    if (page.json) {
      const parsed = parseUsaJobsApi(page.json);
      if (parsed.length) return parsed;
    }
  }
  const htmlUrl = `https://www.usajobs.gov/Search/Results?k=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}`;
  const page = await fetchPage(htmlUrl);
  if (!page.text) return [];
  return parseUsaJobsSearchHtml(page.text);
}

export async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += Math.max(1, size)) {
    const chunk = items.slice(i, i + Math.max(1, size));
    const part = await Promise.all(chunk.map((item) => fn(item).catch(() => null as R)));
    out.push(...part.filter((row) => row != null));
  }
  return out;
}

let govBoardCursor = 0;

export async function fetchAllGovernmentJobs(): Promise<ApplyQueueItem[]> {
  const boards = govEmployerSeed().filter((e) => e.board === "governmentjobs");
  const slice: EmployerRecord[] = [];
  if (boards.length) {
    const take = Math.min(4, boards.length);
    for (let i = 0; i < take; i++) slice.push(boards[(govBoardCursor + i) % boards.length]);
    govBoardCursor = (govBoardCursor + take) % boards.length;
  }
  const boardJobs = await mapPool(slice, 3, fetchGovernmentJobsBoard);
  const usa = await Promise.all(
    [
      fetchUsaJobsPublic("information technology", "Texas"),
      fetchUsaJobsPublic("cybersecurity", "United States"),
    ].map((p) => p.catch(() => [] as ApplyQueueItem[]))
  );
  return [...boardJobs.flat(), ...usa.flat()];
}
