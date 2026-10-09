import metros from "../data/metros.json" with { type: "json" };
import aliases from "../data/title-aliases.json" with { type: "json" };
import employersSeed from "../data/dfw-employers.json" with { type: "json" };
import { titleRelevance } from "./answers.js";
import { normalize, tokens } from "./fuzzy.js";

export const BLOCKED_JOB_HOSTS = ["linkedin.com", "indeed.com", "glassdoor.com"];

export type WorkMode = "onsite" | "hybrid" | "remote";
export type ExperienceLevel = "intern" | "new-grad" | "entry" | "mid" | "senior";
export type AlertTiming = "instant" | "daily" | "weekly";
export type BoardKind = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "usajobs" | "adzuna" | "career-page" | "unknown";

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
  metro: "dfw",
  radiusMiles: 20,
  remoteOk: true,
  hybridOk: true,
  titles: ["software engineer", "it systems"],
  nicheKeywords: ["cybersecurity compliance"],
  industries: [],
  experienceLevel: "entry",
  salaryFloor: null,
  needsSponsorship: null,
  excludeCompanies: [],
  alertTiming: "daily",
  scoreThreshold: 60,
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

export function geocodeLocation(text: string, metroId = "dfw"): { lat: number; lng: number; label: string } | null {
  const metro = (metros as Record<string, { places: Record<string, { lat: number; lng: number }>; center: { lat: number; lng: number } }>)[
    metroId
  ];
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
  if (listing.workMode === "remote") {
    if (!settings.remoteOk) return { pass: false, reason: "remote not welcome" };
  } else if (listing.workMode === "hybrid") {
    if (!settings.hybridOk && !settings.remoteOk) return { pass: false, reason: "hybrid not welcome" };
  } else {
    const home = geocodeLocation(settings.homeCity, settings.metro);
    if (home && listing.lat != null && listing.lng != null) {
      const miles = haversineMiles(home, { lat: listing.lat, lng: listing.lng });
      if (miles > settings.radiusMiles) return { pass: false, reason: `outside ${settings.radiusMiles} mile radius` };
    } else if (home && !geocodeLocation(listing.locationText, settings.metro)) {
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
  score = Math.max(0, Math.min(100, score));
  const why = titleHit
    ? `Title lines up with ${settings.titles[0] || "your targets"}${nicheHits.length ? ` and mentions ${nicheHits[0]}` : ""}.`
    : `Nearby title; ${nicheHits.length ? `niche terms: ${nicheHits.join(", ")}` : "weak niche overlap"}.`;
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
  const metroSeed = seed.filter((e) => e.metro === metro);
  const withFeed = mapped.filter((e) => e.metro === metro && e.slug && e.board !== "unknown");
  return {
    metro,
    seedCount: metroSeed.length,
    mappedCount: withFeed.length,
    unmapped: metroSeed.filter((e) => !e.slug || e.board === "unknown").map((e) => e.company),
    note: "No system finds every job. This is the share of the seed list with a public feed we can pull.",
  };
}

export function seedEmployers(): EmployerRecord[] {
  return employersSeed.employers as EmployerRecord[];
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
