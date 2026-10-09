import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  compactDbCache,
  dbStats,
  employerRecord,
  harvestRecord,
  isDbRecord,
  listingRecord,
  parseDbQuery,
  queryRecords,
  upsertRecords,
  type DbRecord,
  type EmployerRecord,
} from "@fillglen/core";
import { db, id } from "./db.js";
import { allListings } from "./finder/pipeline.js";

type Auth = (req: Request, res: Response, next: NextFunction) => void;

function allLocal(): DbRecord[] {
  return db.filter("localRecords", () => true) as unknown as DbRecord[];
}

export function searchDatabase(raw?: Record<string, unknown>) {
  const query = parseDbQuery(raw);
  return queryRecords(allLocal(), query);
}

export function databaseStats() {
  return dbStats(allLocal());
}

export function ingestRecords(incoming: DbRecord[]) {
  const merged = upsertRecords(allLocal(), incoming.filter(isDbRecord));
  db.replace("localRecords", merged as unknown as Record<string, unknown>[]);
  return dbStats(merged);
}

export function archiveListings() {
  const listings = allListings();
  const employers = db.filter("employers", () => true) as unknown as EmployerRecord[];
  const incoming: DbRecord[] = [...listings.map(listingRecord), ...employers.map(employerRecord)];
  if (!incoming.length) return databaseStats();
  return ingestRecords(incoming);
}

export function archiveFinderCycle(tick: {
  fetched?: number;
  stored?: number;
  closed?: number;
  maps?: number;
  note?: string;
  via?: string;
}) {
  const at = new Date().toISOString();
  const row = harvestRecord({ ...tick, at, via: tick.via || "api" });
  db.insert("harvestLog", {
    id: id(),
    at,
    fetched: tick.fetched ?? 0,
    stored: tick.stored ?? 0,
    closed: tick.closed ?? 0,
    maps: tick.maps ?? 0,
    via: tick.via || "api",
    note: tick.note || row.why,
  });
  ingestRecords([row]);
  return archiveListings();
}

export function mountDatabase(app: Express, _auth: Auth) {
  app.get("/v1/database/stats", (_req, res) => {
    res.json(compactDbCache(databaseStats()));
  });

  app.get("/v1/database/search", (req, res) => {
    res.json(searchDatabase(req.query as Record<string, unknown>));
  });

  app.get("/v1/database/record/:id", (req, res) => {
    const row = allLocal().find((r) => r.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  app.post("/v1/database/ingest", (req, res) => {
    const parsed = z
      .object({
        records: z.array(z.any()).default([]),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const stats = ingestRecords(parsed.data.records as unknown as DbRecord[]);
    res.json({ ok: true, ...compactDbCache(stats) });
  });
}
