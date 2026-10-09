import metros from "../data/metros.json" with { type: "json" };
import aliases from "../data/title-aliases.json" with { type: "json" };
import employersSeed from "../data/dfw-employers.json" with { type: "json" };
import usItEmployers from "../data/us-it-employers.json" with { type: "json" };
import { titleRelevance } from "./answers.js";
import { normalize, tokens } from "./fuzzy.js";

export const BLOCKED_JOB_HOSTS = ["linkedin.com", "indeed.com", "glassdoor.com"];

export type WorkMode = "onsite" | "hybrid" | "remote";
export type ExperienceLevel = "intern" | "new-grad" | "entry" | "mid" | "senior";
export type AlertTiming = "instant" | "daily" | "weekly";
export type BoardKind =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "usajobs"
  | "adzuna"
  | "taleo"
  | "successfactors"
  | "workday"
  | "icims"
  | "jobvite"
  | "workable"
  | "recruitee"
  | "career-page"
  | "unknown";

export interface SearchSettings {
  homeCity: string;
  metro: string;
  radiusMiles: number;
  remoteOk: boolean;
  hybridOk: boolean;
  titles: string[];
  nicheKeywords: string[];
  industries: string[];
  experienceLevel: ExperienceLevel;
  salaryFloor: number | null;
  needsSponsorship: boolean | null;
  excludeCompanies: string[];
  alertTiming: AlertTiming;
  scoreThreshold: number;
}

export const DEFAULT_SEARCH: SearchSettings = {
  homeCity: "Carrollton, TX",
  metro: "texas",
  radiusMiles: 2500,
  remoteOk: true,
  hybridOk: true,
  titles: [
    "software engineer",
    "it systems",
    "it support",
    "systems administrator",
    "help desk",
    "network engineer",
    "cybersecurity",
    "information technology",
  ],
  nicheKeywords: ["cybersecurity compliance", "information technology", "systems administrator", "IT support"],
  industries: ["information technology"],
  experienceLevel: "entry",
  salaryFloor: null,
  needsSponsorship: null,
  excludeCompanies: [],
  alertTiming: "daily",
  scoreThreshold: 50,
};

export interface SourceLink {
  source: BoardKind | string;
  url: string;
}

/** A listing the platform may show. AI is not allowed to mint these. */
export interface CanonicalListing {
  id: string;
  title: string;
  company: string;
  locationText: string;
  lat: number | null;
  lng: number | null;
  workMode: WorkMode;
  remoteWhere?: string;
  salaryText?: string;
  salaryMin?: number | null;
  description: string;
  url: string;
  source: BoardKind | string;
  sources: SourceLink[];
  firstSeenAt: string;
  lastCheckedAt: string;
  postedAt?: string;
  status: "open" | "closed";
  employerSlug?: string;
}

export interface ScoreCard {
  listingId: string;
  score: number;
  why: string;
  inferredLevel: ExperienceLevel | "unknown";
  warnings: string[];
  via: "rules" | "ai" | "cache";
}

export interface EmployerRecord {
  company: string;
  metro: string;
  careersUrl: string;
  board: BoardKind | string;
  slug: string;
  sourceKind: string;
  hqHint?: string;
}

export function assertRealListing(row: Partial<CanonicalListing>): asserts row is CanonicalListing {
  if (!row.url || !row.source || !row.firstSeenAt || !row.lastCheckedAt || !row.company || !row.title) {
    throw new Error("Listings must come from a real source: url, source, firstSeenAt, and lastCheckedAt are required. The AI never creates jobs.");
  }
  if (isBlockedJobUrl(row.url)) {
    throw new Error("LinkedIn, Indeed, and Glassdoor are not allowed sources.");
  }
}

export function isBlockedJobUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_JOB_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return BLOCKED_JOB_HOSTS.some((h) => url.toLowerCase().includes(h));
  }
}

export function detectBoardFromCareersUrl(url: string): { board: BoardKind; slug: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    if (host.endsWith("greenhouse.io") && parts[0]) return { board: "greenhouse", slug: parts[0] };
    if (host.endsWith("lever.co") && parts[0]) return { board: "lever", slug: parts[0] };
    if (host.endsWith("ashbyhq.com") && parts[0]) return { board: "ashby", slug: parts[0] };
    if (host.endsWith("smartrecruiters.com") && parts[0]) return { board: "smartrecruiters", slug: parts[0] };
    if (host.endsWith("taleo.net")) return { board: "taleo", slug: parts[0] || host.split(".")[0] };
    if (host.includes("successfactors") || host.includes("sapsf.")) return { board: "successfactors", slug: host.split(".")[0] };
    if (host.includes("myworkdayjobs") || host.includes("myworkdaysite") || host.includes("workday")) {
      return { board: "workday", slug: host.split(".")[0] };
    }
    if (host.endsWith("icims.com")) return { board: "icims", slug: host.split(".")[0] };
    if (host.endsWith("jobvite.com") && parts[0]) return { board: "jobvite", slug: parts[0] };
    if (host.endsWith("workable.com") && parts[0]) return { board: "workable", slug: parts[0] };
    if (host.endsWith("recruitee.com")) return { board: "recruitee", slug: host.split(".")[0] };
    return null;
  } catch {
    return null;
  }
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

type MetroFile = Record<string, { places: Record<string, { lat: number; lng: number }>; center: { lat: number; lng: number } }>;

function matchPlace(text: string, metroId: string): { lat: number; lng: number; label: string } | null {
  const metro = (metros as MetroFile)[metroId];
  if (!metro) return null;
  const n = normalize(text);
  if (!n) return null;
  const places = Object.entries(metro.places).sort((x, y) => y[0].length - x[0].length);
  for (const [name, coord] of places) {
    if (n.includes(name)) return { ...coord, label: name };
  }
  if (/\bremote\b/.test(n) && /\bdallas\b|\bfort worth\b|\bdfw\b/.test(n)) {
    return { ...metro.center, label: "dfw" };
  }
  return null;
}

export function geocodeLocation(text: string, metroId = "texas"): { lat: number; lng: number; label: string } | null {
  const direct = matchPlace(text, metroId);
  if (direct) return direct;
  for (const id of Object.keys(metros as MetroFile)) {
    if (id === metroId) continue;
    const hit = matchPlace(text, id);
    if (hit) return hit;
  }
  return null;
}

const TEXAS_HINT =
  /\b(tx|texas|dallas|fort worth|dfw|houston|austin|san antonio|el paso|plano|irving|arlington|frisco|mckinney|carrollton|lubbock|corpus christi|amarillo|waco|midland|odessa|beaumont|tyler|college station|galveston|the woodlands|sugar land|killeen|laredo|brownsville|mcallen|denton|richardson|garland|grand prairie|mesquite|pasadena|pearland|round rock|cedar park)\b/;

export function isTexasLocation(text: string): boolean {
  return TEXAS_HINT.test(normalize(text));
}

export function isUsLocation(text: string): boolean {
  if (!text) return false;
  if (isTexasLocation(text)) return true;
  const n = normalize(text);
  if (/\b(united states|usa|united states of america|remote us|us remote|nationwide)\b/.test(n)) return true;
  return /[A-Za-z],\s*(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|UT|VA|VT|WA|WI|WV|WY|TX)\b/i.test(
    text
  );
}

export function isNonUsLocation(text: string): boolean {
  const n = normalize(text);
  if (isUsLocation(n) || isTexasLocation(n)) return false;
  return /\b(united kingdom|london|england|uk remote|canada|toronto|vancouver|india|bengaluru|bangalore|hyderabad|pune|chennai|singapore|sydney|melbourne|berlin|munich|dublin|amsterdam|warsaw|krakow|poland|france|paris|emea|apac|germany|netherlands|ireland|australia|mexico city|sao paulo|tokyo|seoul|remote uk|remote eu|remote emea)\b/.test(
    n
  );
}

const IT_TITLE =
  /\b(software|developer|programmer|sysadmin|systems analyst|systems administrator|cyber|security engineer|information (technology|security|systems)|it (support|systems|analyst|specialist|technician|coordinator|operations|engineer|manager)|help desk|desktop support|network engineer|site reliability|\bsre\b|devops|cloud engineer|data engineer|data analyst|database administrator|\bdba\b|qa engineer|\bsdet\b|platform engineer|infrastructure engineer|full[- ]stack|frontend|backend|machine learning|ml engineer|ai engineer|application engineer|service desk|end user support|\bit\b|\binfosec\b)\b/i;

/** Conservative IT / software title check used to keep the built-in queue on-role. */
export function looksLikeItRole(title: string): boolean {
  return IT_TITLE.test(title);
}

export function classifyWorkMode(title: string, location: string, description: string): WorkMode {
  const blob = `${title} ${location} ${description}`.toLowerCase();
  if (/\bhybrid\b/.test(blob)) return "hybrid";
  if (/\bremote\b/.test(blob) && !/\bon-?site only\b/.test(blob)) return "remote";
  return "onsite";
}

export function remoteWhereText(location: string, description: string): string | undefined {
  const blob = `${location} ${description}`;
  const m = blob.match(/remote[^\n.]{0,80}/i);
  return m ? m[0].trim() : undefined;
}

/** Attach the 24/7 finder score when the live window opens a posting from that feed. */
export function feedMetaForUrl(
  url: string,
  rows: { url: string; score: number; why?: string; source?: string }[]
): { feedScore: number; feedWhy?: string; feedSource?: string } | null {
  const hit = rows.find((r) => r.url === url || (r.url && url.startsWith(r.url)) || (url && r.url.startsWith(url.split("?")[0])));
  if (!hit) return null;
  return { feedScore: hit.score, feedWhy: hit.why, feedSource: hit.source };
}

export function expandTitles(titles: string[]): string[] {
  const out = new Set<string>();
  for (const t of titles) {
    out.add(normalize(t));
    const extra = (aliases as Record<string, string[]>)[normalize(t)] || [];
    extra.forEach((x) => out.add(normalize(x)));
  }
  return [...out];
}

export function inferExperience(description: string, title: string): ExperienceLevel | "unknown" {
  const blob = `${title} ${description}`.toLowerCase();
  const years = [...blob.matchAll(/(\d+)\+?\s*\+?\s*years?/g)].map((m) => Number(m[1]));
  const maxYears = years.length ? Math.max(...years) : 0;
  if (/\bintern\b/.test(blob)) return "intern";
  if (/new grad|university grad|college grad/.test(blob)) return "new-grad";
  if (maxYears >= 5 || /\bsenior\b|\bstaff\b|\bprincipal\b/.test(blob)) return "senior";
  if (maxYears >= 3 || /\bmid-level\b/.test(blob)) return "mid";
  if (maxYears >= 1 || /\bentry\b|junior/.test(blob)) return "entry";
  return "unknown";
}

const LEVEL_RANK: Record<string, number> = { intern: 0, "new-grad": 1, entry: 2, mid: 3, senior: 4, unknown: 2 };

export function tooSenior(inferred: ExperienceLevel | "unknown", target: ExperienceLevel): boolean {
  return (LEVEL_RANK[inferred] ?? 2) > (LEVEL_RANK[target] ?? 2) + 1;
}

export function warningSigns(listing: CanonicalListing): string[] {
  const w: string[] = [];
  if (!listing.company || /confidential|unlisted/i.test(listing.company)) w.push("No company name");
  if (/wire money|pay a fee|training fee|whatsapp/i.test(listing.description)) w.push("Payment or off-platform request");
  const first = Date.parse(listing.firstSeenAt);
  const posted = listing.postedAt ? Date.parse(listing.postedAt) : first;
  if (Number.isFinite(posted) && Date.now() - posted > 1000 * 60 * 60 * 24 * 90) w.push("Reposted or open for months");
  return w;
}

export function listingDedupeKey(listing: Pick<CanonicalListing, "company" | "title" | "locationText">): string {
  return [normalize(listing.company), normalize(listing.title), normalize(listing.locationText).split(" ").slice(0, 2).join(" ")].join("|");
}

export function dedupeListings(rows: CanonicalListing[]): CanonicalListing[] {
  const map = new Map<string, CanonicalListing>();
  for (const row of rows) {
    assertRealListing(row);
    const key = listingDedupeKey(row);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row, sources: row.sources?.length ? row.sources : [{ source: row.source, url: row.url }] });
      continue;
    }
    const sources = [...prev.sources];
    if (!sources.some((s) => s.url === row.url)) sources.push({ source: row.source, url: row.url });
    map.set(key, {
      ...prev,
      sources,
      lastCheckedAt: row.lastCheckedAt > prev.lastCheckedAt ? row.lastCheckedAt : prev.lastCheckedAt,
      firstSeenAt: row.firstSeenAt < prev.firstSeenAt ? row.firstSeenAt : prev.firstSeenAt,
      description: row.description.length > prev.description.length ? row.description : prev.description,
    });
  }
  return [...map.values()];
}

export function ruleFilter(listing: CanonicalListing, settings: SearchSettings): { pass: boolean; reason?: string } {
  assertRealListing(listing);
  if (settings.excludeCompanies.some((c) => normalize(c) === normalize(listing.company))) {
    return { pass: false, reason: "excluded company" };
  }
  const where = `${listing.locationText} ${listing.remoteWhere || ""} ${listing.description.slice(0, 400)}`;
  if (isNonUsLocation(where) && !isUsLocation(where)) {
    return { pass: false, reason: "outside the United States" };
  }
  if (listing.workMode === "remote") {
    if (!settings.remoteOk) return { pass: false, reason: "remote not welcome" };
  } else if (listing.workMode === "hybrid") {
    if (!settings.hybridOk && !settings.remoteOk) return { pass: false, reason: "hybrid not welcome" };
  } else if (!isTexasLocation(listing.locationText)) {
    const home = geocodeLocation(settings.homeCity, settings.metro);
    const loc =
      listing.lat != null && listing.lng != null
        ? { lat: listing.lat, lng: listing.lng }
        : geocodeLocation(listing.locationText, settings.metro);
    if (home && loc) {
      const miles = haversineMiles(home, loc);
      if (miles > settings.radiusMiles) return { pass: false, reason: `outside ${settings.radiusMiles} mile radius` };
    } else if (home && !loc && !isUsLocation(listing.locationText)) {
      return { pass: false, reason: "location not in metro" };
    }
  }
  const inferred = inferExperience(listing.description, listing.title);
  if (tooSenior(inferred, settings.experienceLevel)) return { pass: false, reason: "above experience level" };
  if (settings.salaryFloor && listing.salaryMin && listing.salaryMin < settings.salaryFloor) {
    return { pass: false, reason: "below salary floor" };
  }
  if (settings.needsSponsorship === true && /no sponsorship|cannot sponsor|not sponsoring|without sponsorship/i.test(listing.description)) {
    return { pass: false, reason: "no visa sponsorship" };
  }
  return { pass: true };
}

export function scoreCacheKey(listingId: string, settings: SearchSettings): string {
  return [
    listingId,
    normalize(settings.titles.join(",")),
    normalize(settings.nicheKeywords.join(",")),
    settings.experienceLevel,
  ].join("|");
}

export function ruleScore(listing: CanonicalListing, settings: SearchSettings): ScoreCard {
  assertRealListing(listing);
  const expanded = expandTitles(settings.titles);
  const relevance = titleRelevance(listing.title, [...settings.titles, ...expanded]);
  const titleHit = relevance >= 0.55;
  const niche = [...settings.nicheKeywords, ...settings.industries];
  const blob = `${listing.title} ${listing.description}`;
  const nicheHits = niche.filter((k) => normalize(blob).includes(normalize(k)) || expandTitles([k]).some((a) => normalize(blob).includes(a)));
  let score = 0;
  if (titleHit) score += 45;
  else score += Math.round(40 * relevance);
  score += Math.min(35, nicheHits.length * 12);
  const inferred = inferExperience(listing.description, listing.title);
  if (inferred === settings.experienceLevel || inferred === "unknown") score += 15;
  else if (!tooSenior(inferred, settings.experienceLevel)) score += 8;
  const warnings = warningSigns(listing);
  if (warnings.length) score -= 20;
  if (isTexasLocation(listing.locationText) || isTexasLocation(listing.company)) {
    score += 15;
  } else if (isUsLocation(listing.locationText) || listing.workMode === "remote") {
    score += 6;
  }
  if (isNonUsLocation(listing.locationText)) score -= 30;
  score = Math.max(0, Math.min(100, score));
  const where = isTexasLocation(listing.locationText)
    ? " Texas hiring"
    : isUsLocation(listing.locationText)
      ? " US location"
      : "";
  const why = titleHit
    ? `Title lines up with ${settings.titles[0] || "your targets"}${nicheHits.length ? ` and mentions ${nicheHits[0]}` : ""}.${where}`
    : `Nearby title; ${nicheHits.length ? `niche terms: ${nicheHits.join(", ")}` : "weak niche overlap"}.${where}`;
  return { listingId: listing.id, score, why, inferredLevel: inferred, warnings, via: "rules" };
}

export function applyFeedback(
  score: number,
  listing: CanonicalListing,
  feedback: { listingId?: string; company?: string; sentiment: "up" | "down"; reason?: string }[]
): number {
  let s = score;
  for (const f of feedback) {
    if (f.listingId === listing.id && f.sentiment === "down") s -= 25;
    if (f.listingId === listing.id && f.sentiment === "up") s += 10;
    if (f.company && normalize(f.company) === normalize(listing.company) && f.sentiment === "down") s -= 8;
    if (f.reason === "too senior" && inferExperience(listing.description, listing.title) === "senior") s -= 15;
    if (f.reason === "wrong location" && listing.workMode === "onsite") s -= 10;
    if (f.reason === "wrong industry") s -= 10;
  }
  return Math.max(0, Math.min(100, s));
}

export function coverage(
  mapped: EmployerRecord[],
  seed: EmployerRecord[] = employersSeed.employers as EmployerRecord[],
  metro = "dfw"
) {
  const metroSeed = metro === "all" || metro === "texas" || metro === "us" ? seed : seed.filter((e) => e.metro === metro);
  const withFeed = mapped.filter(
    (e) => (metro === "all" || metro === "texas" || metro === "us" || e.metro === metro) && e.slug && e.board !== "unknown"
  );
  return {
    metro,
    seedCount: metroSeed.length,
    mappedCount: withFeed.length,
    unmapped: metroSeed.filter((e) => !e.slug || e.board === "unknown").map((e) => e.company),
    note: "No system finds every job. This is the share of the seed list with a public feed we can pull.",
  };
}

export function seedEmployers(): EmployerRecord[] {
  const rows = [
    ...(employersSeed.employers as EmployerRecord[]),
    ...(usItEmployers.employers as EmployerRecord[]),
  ];
  const seen = new Set<string>();
  const unique: EmployerRecord[] = [];
  for (const row of rows) {
    const key = `${normalize(row.company)}|${row.board}|${row.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export function aiScorePrompt(listing: CanonicalListing, settings: SearchSettings): { system: string; user: string } {
  assertRealListing(listing);
  return {
    system: `You score a REAL job listing that was already fetched from a public feed.
Never invent companies, URLs, or openings.
Reply JSON only: {"score":0-100,"why":"one sentence","inferredLevel":"intern|new-grad|entry|mid|senior|unknown","warnings":[]}`,
    user: JSON.stringify({
      listing: {
        title: listing.title,
        company: listing.company,
        location: listing.locationText,
        url: listing.url,
        source: listing.source,
        description: listing.description.slice(0, 4000),
      },
      targets: { titles: expandTitles(settings.titles), niche: settings.nicheKeywords, level: settings.experienceLevel },
    }),
  };
}

export function parseAiScore(raw: string, listing: CanonicalListing): ScoreCard | null {
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (typeof json.score !== "number") return null;
    return {
      listingId: listing.id,
      score: Math.max(0, Math.min(100, json.score)),
      why: String(json.why || "").slice(0, 240),
      inferredLevel: json.inferredLevel || inferExperience(listing.description, listing.title),
      warnings: Array.isArray(json.warnings) ? json.warnings.map(String) : warningSigns(listing),
      via: "ai",
    };
  } catch {
    return null;
  }
}

export function targetTokens(settings: SearchSettings): string[] {
  return [...expandTitles(settings.titles), ...settings.nicheKeywords.map(normalize)].flatMap((t) => tokens(t));
}

export { employersSeed, metros };
