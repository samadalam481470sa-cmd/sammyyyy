import { detectBoardFromCareersUrl, isBlockedJobUrl, type EmployerRecord } from "./finder.js";
import { normalize } from "./fuzzy.js";

/** Map tiles covering Texas and a thin band of neighboring states. Not Google Maps scraping. */
export interface MapTile {
  id: string;
  name: string;
  metro: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapCompany {
  name: string;
  website: string;
  lat: number;
  lng: number;
  city?: string;
  tags: string[];
  source: "openstreetmap" | "google-places";
  metro: string;
}

export interface DiscoverStatus {
  running: boolean;
  tileIndex: number;
  companiesSeen: number;
  sitesChecked: number;
  mappedFeeds: number;
  govJobs?: number;
  recordsCompanies?: number;
  lastTile?: string;
  lastAt?: string;
  note: string;
}

export const EMPTY_DISCOVER: DiscoverStatus = {
  running: false,
  tileIndex: 0,
  companiesSeen: 0,
  sitesChecked: 0,
  mappedFeeds: 0,
  govJobs: 0,
  recordsCompanies: 0,
  note: "Map discovery is off. Turn on Autofill & keep applying, or leave the Fillglen API running.",
};

/**
 * Texas metros plus nearby cities just over the state line.
 * OpenStreetMap / Places queries use these boxes. This is not every business in Texas.
 */
export const TEXAS_MAP_TILES: MapTile[] = [
  { id: "dfw", name: "Dallas–Fort Worth", metro: "dfw", south: 32.35, west: -97.65, north: 33.35, east: -96.45 },
  { id: "austin", name: "Austin", metro: "austin", south: 29.95, west: -98.05, north: 30.65, east: -97.45 },
  { id: "houston", name: "Houston", metro: "houston", south: 29.45, west: -95.85, north: 30.15, east: -94.95 },
  { id: "san-antonio", name: "San Antonio", metro: "san-antonio", south: 29.2, west: -98.75, north: 29.7, east: -98.2 },
  { id: "el-paso", name: "El Paso", metro: "texas", south: 31.65, west: -106.6, north: 32.0, east: -106.2 },
  { id: "lubbock", name: "Lubbock", metro: "texas", south: 33.45, west: -102.0, north: 33.7, east: -101.7 },
  { id: "corpus", name: "Corpus Christi", metro: "texas", south: 27.65, west: -97.55, north: 27.9, east: -97.2 },
  { id: "waco", name: "Waco", metro: "texas", south: 31.45, west: -97.25, north: 31.7, east: -96.95 },
  { id: "college-station", name: "College Station", metro: "texas", south: 30.5, west: -96.45, north: 30.75, east: -96.2 },
  { id: "tyler", name: "Tyler", metro: "texas", south: 32.2, west: -95.45, north: 32.45, east: -95.2 },
  { id: "amarillo", name: "Amarillo", metro: "texas", south: 35.1, west: -101.95, north: 35.3, east: -101.7 },
  { id: "midland", name: "Midland–Odessa", metro: "texas", south: 31.75, west: -102.45, north: 32.05, east: -102.0 },
  { id: "the-woodlands", name: "The Woodlands", metro: "houston", south: 30.05, west: -95.55, north: 30.25, east: -95.35 },
  { id: "plano-frisco", name: "Plano–Frisco", metro: "dfw", south: 33.0, west: -96.95, north: 33.22, east: -96.65 },
  { id: "round-rock", name: "Round Rock", metro: "austin", south: 30.45, west: -97.75, north: 30.6, east: -97.6 },
  { id: "shreveport", name: "Shreveport (near East Texas)", metro: "texas", south: 32.35, west: -93.9, north: 32.6, east: -93.65 },
  { id: "lawton", name: "Lawton (near North Texas)", metro: "texas", south: 34.5, west: -98.5, north: 34.7, east: -98.3 },
  { id: "las-cruces", name: "Las Cruces (near El Paso)", metro: "texas", south: 32.25, west: -106.85, north: 32.4, east: -106.7 },
  { id: "texarkana", name: "Texarkana", metro: "texas", south: 33.35, west: -94.15, north: 33.5, east: -93.95 },
];

const IT_HINT =
  /\b(it\b|information tech|software|cyber|cloud|data|semiconductor|chip|systems|network|telecom|digital|computer|saas|devops|security|analytics|fintech|insurtech|healthtech|\bai\b|machine learning|technology|tech\b)\b/i;

export function looksLikeItCompany(name: string, tags: string[] = []): boolean {
  const blob = `${name} ${tags.join(" ")}`;
  if (/\b(office|it|software|telecommunication|research|consulting)\b/i.test(tags.join(" "))) return true;
  return IT_HINT.test(blob);
}

export function overpassQuery(tile: MapTile, limit = 80): string {
  const bbox = `${tile.south},${tile.west},${tile.north},${tile.east}`;
  return `[out:json][timeout:25];
(
  nwr["office"]["website"](${bbox});
  nwr["office"]["contact:website"](${bbox});
  nwr["office"~"it|software|telecommunication|research|company"](${bbox});
  nwr["industrial"]["website"](${bbox});
);
out center tags ${limit};`;
}

export function googlePlacesQuery(tile: MapTile): string {
  return `IT software technology companies in ${tile.name}`;
}

export interface OverpassElement {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export function parseOverpassElements(elements: OverpassElement[], tile: MapTile): MapCompany[] {
  const out: MapCompany[] = [];
  const seen = new Set<string>();
  for (const el of elements || []) {
    const tags = el.tags || {};
    const name = (tags.name || tags.brand || "").trim();
    const website = normalizeWebsite(tags.website || tags["contact:website"] || "");
    if (!name || !website || isBlockedJobUrl(website)) continue;
    const key = `${normalize(name)}|${website}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lat = el.lat ?? el.center?.lat ?? (tile.south + tile.north) / 2;
    const lng = el.lon ?? el.center?.lon ?? (tile.west + tile.east) / 2;
    out.push({
      name,
      website,
      lat,
      lng,
      city: tags["addr:city"] || tile.name,
      tags: [tags.office, tags.industrial, tags.company].filter(Boolean) as string[],
      source: "openstreetmap",
      metro: tile.metro,
    });
  }
  return out.sort((a, b) => Number(looksLikeItCompany(b.name, b.tags)) - Number(looksLikeItCompany(a.name, a.tags)));
}

export interface PlacesHit {
  name?: string;
  place_id?: string;
  website?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  types?: string[];
}

export function parseGooglePlacesResults(results: PlacesHit[], tile: MapTile): MapCompany[] {
  const out: MapCompany[] = [];
  for (const hit of results || []) {
    const name = (hit.name || "").trim();
    if (!name) continue;
    const website = normalizeWebsite(hit.website || "");
    out.push({
      name,
      website,
      lat: hit.geometry?.location?.lat ?? (tile.south + tile.north) / 2,
      lng: hit.geometry?.location?.lng ?? (tile.west + tile.east) / 2,
      city: hit.formatted_address,
      tags: hit.types || [],
      source: "google-places",
      metro: tile.metro,
    });
  }
  return out;
}

export function normalizeWebsite(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol)) return "";
    return `${u.origin}${u.pathname.replace(/\/$/, "")}` || u.origin;
  } catch {
    return "";
  }
}

export function extractCareerLinks(html: string, baseUrl: string): string[] {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const href of hrefs) {
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    let abs = "";
    try {
      abs = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    if (isBlockedJobUrl(abs)) continue;
    if (
      !/careers|jobs|join[-_ ]?us|job-board|opportunit|greenhouse|lever\.co|ashbyhq|workday|taleo|icims|smartrecruiters|jobvite|successfactors|phenom|eightfold|bamboohr|workable/i.test(
        abs
      )
    ) {
      continue;
    }
    const key = abs.split("?")[0].replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(abs);
  }
  return out.slice(0, 12);
}

export function detectAtsInHtml(html: string, pageUrl: string): { board: string; slug: string } | null {
  const direct = detectBoardFromCareersUrl(pageUrl);
  if (direct) return direct;
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map((m) => m[0]);
  for (const u of urls) {
    if (isBlockedJobUrl(u)) continue;
    const hit = detectBoardFromCareersUrl(u);
    if (hit) return hit;
  }
  return null;
}

export function commonCareerPaths(website: string): string[] {
  const base = website.replace(/\/$/, "");
  return [`${base}/careers`, `${base}/jobs`, `${base}/careers/jobs`, `${base}/join`, `${base}/join-us`];
}

export async function inspectCompanyCareers(
  company: MapCompany,
  fetchHtml: (url: string) => Promise<string | null>
): Promise<EmployerRecord | null> {
  const site = normalizeWebsite(company.website);
  if (!site || isBlockedJobUrl(site)) return null;
  const html = await fetchHtml(site);
  const fromHome = html ? extractCareerLinks(html, site) : [];
  const candidates = [...fromHome, ...commonCareerPaths(site)];
  const seen = new Set<string>();
  let fallback: string | null = fromHome[0] || null;
  for (const url of candidates) {
    const key = url.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const detected = detectBoardFromCareersUrl(url);
    if (detected) {
      return employerRow(company, url, detected.board, detected.slug);
    }
    const page = await fetchHtml(url);
    if (!page) continue;
    if (!fallback) fallback = url;
    const ats = detectAtsInHtml(page, url);
    if (ats) return employerRow(company, url, ats.board, ats.slug);
  }
  if (fallback) return employerRow(company, fallback, "unknown", "");
  return null;
}

function employerRow(company: MapCompany, careersUrl: string, board: string, slug: string): EmployerRecord {
  return {
    company: company.name,
    metro: company.metro,
    careersUrl,
    board,
    slug,
    sourceKind: "map-discover",
    hqHint: company.city || company.name,
  };
}

export function nextDiscoverStatus(prev: DiscoverStatus, patch: Partial<DiscoverStatus>): DiscoverStatus {
  return {
    ...EMPTY_DISCOVER,
    ...prev,
    ...patch,
    lastAt: patch.lastAt || new Date().toISOString(),
  };
}

export function discoverNote(status: DiscoverStatus): string {
  const gov = status.govJobs || 0;
  const rec = status.recordsCompanies || 0;
  return `Texas map scan: ${status.companiesSeen} companies seen, ${status.sitesChecked} career sites checked, ${status.mappedFeeds} public job feeds mapped${
    status.lastTile ? ` · last area ${status.lastTile}` : ""
  }. Extra research: ${gov} government postings, ${rec} companies from public filings/directories. Not every business in Texas is on a public map. Google Maps is not scraped.`;
}

export async function fetchOverpassTile(
  tile: MapTile,
  fetchImpl: typeof fetch = fetch
): Promise<MapCompany[]> {
  const body = `data=${encodeURIComponent(overpassQuery(tile))}`;
  try {
    const r = await fetchImpl("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(28000),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { elements?: OverpassElement[] };
    return parseOverpassElements(data.elements || [], tile);
  } catch {
    return [];
  }
}

export function rankMapCompanies(companies: MapCompany[]): MapCompany[] {
  return [...companies].sort((a, b) => {
    const ai = looksLikeItCompany(a.name, a.tags) ? 1 : 0;
    const bi = looksLikeItCompany(b.name, b.tags) ? 1 : 0;
    if (bi !== ai) return bi - ai;
    return a.name.localeCompare(b.name);
  });
}
