import {
  aiScorePrompt,
  applyFeedback,
  assertRealListing,
  coverage,
  dedupeListings,
  parseAiScore,
  ruleFilter,
  ruleScore,
  scoreCacheKey,
  seedEmployers,
  type CanonicalListing,
  type EmployerRecord,
  type ScoreCard,
  type SearchSettings,
} from "@fillglen/core";
import { db, id } from "../db.js";
import { createAiProvider } from "./provider.js";
import { employerFromCareersLink, fetchAdzuna, fetchEmployerFeed, fetchUsaJobs } from "./sources.js";

const SYSTEM_AI_LIMIT = Number(process.env.FILLGLEN_AI_DAILY_LIMIT || 200);
const USER_AI_LIMIT = Number(process.env.FILLGLEN_AI_USER_DAILY || 40);

function listings(): CanonicalListing[] {
  return db.filter("listings", () => true) as unknown as CanonicalListing[];
}

function employers(): EmployerRecord[] {
  const extra = db.filter("employers", () => true) as unknown as EmployerRecord[];
  const seed = seedEmployers();
  const seen = new Set(extra.map((e) => `${e.board}:${e.slug}:${e.company}`));
  return [...extra, ...seed.filter((s) => !seen.has(`${s.board}:${s.slug}:${s.company}`))];
}

export function getCoverage(metro = "dfw") {
  return coverage(employers(), seedEmployers(), metro);
}

export function upsertListing(incoming: CanonicalListing) {
  assertRealListing(incoming);
  const existing = db.find("listings", (l) => l.id === incoming.id || l.url === incoming.url);
  if (existing) {
    db.update("listings", (l) => l.id === existing.id, {
      ...incoming,
      firstSeenAt: existing.firstSeenAt || incoming.firstSeenAt,
      lastCheckedAt: incoming.lastCheckedAt,
    });
    return;
  }
  db.insert("listings", incoming as unknown as Record<string, unknown>);
}

export async function verifyLink(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (r.status === 405 || r.status === 403) {
      const g = await fetch(url, { method: "GET", redirect: "follow" });
      return g.ok;
    }
    return r.ok;
  } catch {
    return false;
  }
}

export async function runFetch(opts: { includeUsa?: boolean; includeAdzuna?: boolean } = {}): Promise<{ fetched: number; stored: number }> {
  const all: CanonicalListing[] = [];
  for (const emp of employers()) {
    try {
      all.push(...(await fetchEmployerFeed(emp)));
    } catch {
      /* dead slug — coverage stays honest */
    }
  }
  if (opts.includeUsa) all.push(...(await fetchUsaJobs("Dallas, TX")));
  if (opts.includeAdzuna) all.push(...(await fetchAdzuna("software", "Dallas")));
  const unique = dedupeListings(all);
  const seenIds = new Set(unique.map((u) => u.id));
  for (const row of unique) upsertListing(row);
  for (const old of listings()) {
    if (old.status === "open" && !seenIds.has(old.id) && old.source !== "career-page") {
      db.update("listings", (l) => l.id === old.id, { lastCheckedAt: new Date().toISOString() });
    }
  }
  return { fetched: all.length, stored: unique.length };
}

export async function recheckOpen(): Promise<{ closed: number }> {
  let closed = 0;
  for (const row of listings().filter((l) => l.status === "open")) {
    const ok = await verifyLink(row.url);
    if (!ok) {
      db.update("listings", (l) => l.id === row.id, { status: "closed", lastCheckedAt: new Date().toISOString() });
      closed += 1;
    } else {
      db.update("listings", (l) => l.id === row.id, { lastCheckedAt: new Date().toISOString() });
    }
  }
  return { closed };
}

function aiCallsToday(): number {
  const day = new Date().toISOString().slice(0, 10);
  return db.filter("aiUsage", (u) => u.day === day && u.cached === false && u.kind === "finder").length;
}

export async function scoreForSearch(
  settings: SearchSettings,
  userId: string,
  feedback: { listingId?: string; company?: string; sentiment: "up" | "down"; reason?: string }[]
): Promise<{ listing: CanonicalListing; card: ScoreCard }[]> {
  const provider = createAiProvider();
  const out: { listing: CanonicalListing; card: ScoreCard }[] = [];
  const batch: CanonicalListing[] = [];
  for (const listing of listings().filter((l) => l.status === "open")) {
    const gate = ruleFilter(listing, settings);
    if (!gate.pass) continue;
    const cacheKey = scoreCacheKey(listing.id, settings);
    const cached = db.find("scoreCache", (c) => c.key === cacheKey);
    let card: ScoreCard;
    if (cached) {
      card = cached.card as ScoreCard;
      card = { ...card, via: "cache" };
    } else {
      card = ruleScore(listing, settings);
      const underCap = aiCallsToday() < SYSTEM_AI_LIMIT && db.filter("aiUsage", (u) => u.userId === userId && u.day === new Date().toISOString().slice(0, 10) && u.cached === false).length < USER_AI_LIMIT;
      if (provider.name !== "none" && underCap && card.score >= 40) {
        batch.push(listing);
      }
      db.insert("scoreCache", { key: cacheKey, card, listingId: listing.id, at: new Date().toISOString() });
    }
    card = { ...card, score: applyFeedback(card.score, listing, feedback) };
    out.push({ listing, card });
  }

  if (batch.length && provider.name !== "none") {
    for (const listing of batch) {
      const prompt = aiScorePrompt(listing, settings);
      const raw = await provider.complete(prompt.system, prompt.user, { batch: true });
      const parsed = raw ? parseAiScore(raw, listing) : null;
      db.insert("aiUsage", {
        id: id(),
        userId,
        tokens: raw.length,
        day: new Date().toISOString().slice(0, 10),
        cached: false,
        kind: "finder",
      });
      if (parsed) {
        const cacheKey = scoreCacheKey(listing.id, settings);
        db.update("scoreCache", (c) => c.key === cacheKey, { card: parsed });
        const row = out.find((o) => o.listing.id === listing.id);
        if (row) row.card = { ...parsed, score: applyFeedback(parsed.score, listing, feedback) };
      }
    }
  }
  return out.sort((a, b) => b.card.score - a.card.score);
}

export async function verifyThenAlert(
  matches: { listing: CanonicalListing; card: ScoreCard }[],
  threshold: number
): Promise<{ listing: CanonicalListing; card: ScoreCard }[]> {
  const keep = [];
  for (const m of matches.filter((x) => x.card.score >= threshold)) {
    if (await verifyLink(m.listing.url)) keep.push(m);
  }
  return keep;
}

export function addEmployerFromUrl(company: string, careersUrl: string, metro = "dfw"): EmployerRecord {
  const rec = employerFromCareersLink(careersUrl, company, metro);
  db.insert("employers", rec as unknown as Record<string, unknown>);
  return rec;
}

export function allListings(): CanonicalListing[] {
  return listings();
}
