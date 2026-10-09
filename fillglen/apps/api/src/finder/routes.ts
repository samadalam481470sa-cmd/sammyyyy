import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { DEFAULT_SEARCH, type SearchSettings } from "@fillglen/core";
import { db, id } from "../db.js";
import { addEmployerFromUrl, getCoverage, runFetch, scoreForSearch, searchSettingsForUser, verifyThenAlert } from "./pipeline.js";
import { loadDiscoverStatus, runMapDiscovery } from "./maps.js";
import { createAiProvider } from "./provider.js";
import { MCP_TOOLS, searchLocalJobs } from "../mcp.js";

type Authed = Request & { userId: string };
type Auth = (req: Request, res: Response, next: NextFunction) => void;

function settingsFor(userId: string): SearchSettings {
  const row = db.find("searches", (s) => s.userId === userId && s.kind === "finder");
  return searchSettingsForUser(userId, { ...DEFAULT_SEARCH, ...((row?.query as SearchSettings) || {}) });
}

const settingsSchema = z.object({
  homeCity: z.string(),
  metro: z.string(),
  radiusMiles: z.coerce.number(),
  remoteOk: z.boolean(),
  hybridOk: z.boolean(),
  titles: z.array(z.string()),
  nicheKeywords: z.array(z.string()),
  industries: z.array(z.string()).default([]),
  experienceLevel: z.enum(["intern", "new-grad", "entry", "mid", "senior"]),
  salaryFloor: z.coerce.number().nullable(),
  needsSponsorship: z.boolean().nullable(),
  excludeCompanies: z.array(z.string()),
  alertTiming: z.enum(["instant", "daily", "weekly"]),
  scoreThreshold: z.coerce.number(),
});

export function mountFinder(app: Express, auth: Auth) {
  app.get("/v1/finder/settings", auth, (req, res) => {
    res.json(settingsFor((req as Authed).userId));
  });

  app.put("/v1/finder/settings", auth, (req, res) => {
    const userId = (req as Authed).userId;
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = db.find("searches", (s) => s.userId === userId && s.kind === "finder");
    if (existing) db.update("searches", (s) => s.id === existing.id, { query: parsed.data });
    else db.insert("searches", { id: id(), userId, kind: "finder", query: parsed.data, createdAt: new Date().toISOString() });
    res.json(parsed.data);
  });

  app.get("/v1/finder/coverage", auth, (_req, res) => {
    res.json(getCoverage("texas"));
  });

  app.post("/v1/finder/employers", auth, (req, res) => {
    const parsed = z.object({ company: z.string(), careersUrl: z.string().url(), metro: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(addEmployerFromUrl(parsed.data.company, parsed.data.careersUrl, parsed.data.metro || "dfw"));
  });

  app.post("/v1/finder/run", auth, async (_req, res) => {
    const maps = await runMapDiscovery({ maxTiles: 1, maxSites: 8 }).catch(() => null);
    const result = await runFetch({ includeUsa: true, includeAdzuna: true });
    res.json({
      ...result,
      maps,
      coverage: getCoverage("texas"),
      provider: createAiProvider().name,
      note: "Search runs on the server 24/7. Map discovery uses OpenStreetMap (and Google Places if a key is set). Google Maps is not scraped.",
    });
  });

  app.get("/v1/finder/discover", auth, (_req, res) => {
    res.json(loadDiscoverStatus());
  });

  app.post("/v1/finder/discover", auth, async (_req, res) => {
    const status = await runMapDiscovery({ maxTiles: 1, maxSites: 8 });
    res.json({ ...status, coverage: getCoverage("texas") });
  });

  app.get("/v1/finder/jobs", auth, async (req, res) => {
    const userId = (req as Authed).userId;
    const settings = settingsFor(userId);
    const feedback = db.filter("feedback", (f) => f.userId === userId) as {
      listingId?: string;
      company?: string;
      sentiment: "up" | "down";
      reason?: string;
    }[];
    const ranked = await scoreForSearch(settings, userId, feedback);
    res.json({
      jobs: ranked.map(({ listing, card }) => ({
        ...listing,
        score: card.score,
        why: card.why,
        inferredLevel: card.inferredLevel,
        warnings: card.warnings,
        via: card.via,
      })),
      coverage: getCoverage(settings.metro || "dfw"),
      settings,
      provider: createAiProvider().name,
    });
  });

  app.get("/v1/finder/matches", auth, async (req, res) => {
    const userId = (req as Authed).userId;
    const settings = settingsFor(userId);
    const feedback = db.filter("feedback", (f) => f.userId === userId) as {
      listingId?: string;
      company?: string;
      sentiment: "up" | "down";
      reason?: string;
    }[];
    const ranked = await scoreForSearch(settings, userId, feedback);
    const fresh = ranked.filter((r) => r.card.score >= settings.scoreThreshold);
    const compact = (listing: typeof ranked[0]["listing"], card: typeof ranked[0]["card"]) => ({
      id: listing.id,
      title: listing.title,
      company: listing.company,
      url: listing.url,
      source: listing.source,
      score: card.score,
      why: card.why,
      firstSeenAt: listing.firstSeenAt,
      lastCheckedAt: listing.lastCheckedAt,
    });
    res.json({
      count: fresh.length,
      top: fresh.slice(0, 3).map(({ listing, card }) => compact(listing, card)),
      lookup: fresh.map(({ listing, card }) => compact(listing, card)),
    });
  });

  app.post("/v1/finder/feedback", auth, (req, res) => {
    const userId = (req as Authed).userId;
    const parsed = z
      .object({
        listingId: z.string().optional(),
        company: z.string().optional(),
        sentiment: z.enum(["up", "down"]),
        reason: z.enum(["too senior", "wrong location", "wrong industry", "other"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(db.insert("feedback", { id: id(), userId, ...parsed.data, at: new Date().toISOString() }));
  });

  app.post("/v1/finder/alerts/dispatch", auth, async (req, res) => {
    const userId = (req as Authed).userId;
    const settings = settingsFor(userId);
    const feedback = db.filter("feedback", (f) => f.userId === userId) as {
      listingId?: string;
      company?: string;
      sentiment: "up" | "down";
      reason?: string;
    }[];
    const ranked = await scoreForSearch(settings, userId, feedback);
    const verified = await verifyThenAlert(ranked, settings.scoreThreshold);
    for (const m of verified) {
      if (db.find("alerts", (a) => a.userId === userId && a.listingId === m.listing.id)) continue;
      db.insert("alerts", {
        id: id(),
        userId,
        listingId: m.listing.id,
        score: m.card.score,
        why: m.card.why,
        at: new Date().toISOString(),
        timing: settings.alertTiming,
      });
    }
    res.json({ sent: verified.length, timing: settings.alertTiming });
  });

  app.get("/v1/finder/alerts", auth, (req, res) => {
    res.json(db.filter("alerts", (a) => a.userId === (req as Authed).userId));
  });

  app.get("/v1/searches", auth, (req, res) => {
    res.json(db.filter("searches", (s) => s.userId === (req as Authed).userId));
  });

  app.get("/v1/mcp/tools", auth, (_req, res) => res.json({ tools: MCP_TOOLS }));

  app.post("/v1/mcp/search_local_jobs", auth, (req, res) => {
    const parsed = z
      .object({ query: z.string(), city: z.string().optional(), radiusMiles: z.coerce.number().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json({ listings: searchLocalJobs(parsed.data) });
  });
}
