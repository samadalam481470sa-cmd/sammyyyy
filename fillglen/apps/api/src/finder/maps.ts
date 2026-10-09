import {
  TEXAS_MAP_TILES,
  detectAtsInHtml,
  discoverNote,
  fetchOverpassTile,
  inspectCompanyCareers,
  nextDiscoverStatus,
  parseGooglePlacesResults,
  rankMapCompanies,
  type DiscoverStatus,
  type EmployerRecord,
  type MapCompany,
  type MapTile,
} from "@fillglen/core";
import { db } from "../db.js";

const OVERPASS_MIN_MS = 4000;

export function loadDiscoverStatus(): DiscoverStatus {
  const row = db.find("searches", (s) => s.kind === "map-discover");
  return (row?.query as DiscoverStatus) || nextDiscoverStatus({} as DiscoverStatus, { running: false });
}

function saveDiscoverStatus(status: DiscoverStatus) {
  const existing = db.find("searches", (s) => s.kind === "map-discover");
  const query = { ...status, note: discoverNote(status) };
  if (existing) db.update("searches", (s) => s.id === existing.id, { query });
  else db.insert("searches", { id: "map-discover", userId: "system", kind: "map-discover", query, createdAt: new Date().toISOString() });
  return query;
}

function upsertEmployer(rec: EmployerRecord) {
  const hit = db.find(
    "employers",
    (e) => e.company === rec.company && (e.slug === rec.slug || e.careersUrl === rec.careersUrl)
  );
  if (hit) {
    if (rec.slug && (!hit.slug || hit.board === "unknown")) {
      db.update("employers", (e) => e.company === rec.company && e.careersUrl === hit.careersUrl, rec as unknown as Record<string, unknown>);
    }
    return;
  }
  db.insert("employers", rec as unknown as Record<string, unknown>);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "Fillglen/0.1 (+https://fillglen.local; public career-page check)" },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!/html|xml|text/i.test(ct) && ct) return null;
    return (await r.text()).slice(0, 200_000);
  } catch {
    return null;
  }
}

async function fetchGooglePlaces(tile: MapTile): Promise<MapCompany[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent(`IT software information technology companies in ${tile.name}`);
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return [];
    const data = (await r.json()) as { results?: { name?: string; place_id?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } }; types?: string[] }[] };
    const basic = parseGooglePlacesResults(data.results || [], tile);
    const withSites: MapCompany[] = [];
    for (const co of basic.slice(0, 8)) {
      const placeId = data.results?.find((x) => x.name === co.name)?.place_id;
      if (!placeId) {
        withSites.push(co);
        continue;
      }
      try {
        const d = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,geometry,formatted_address,types&key=${key}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!d.ok) {
          withSites.push(co);
          continue;
        }
        const body = (await d.json()) as { result?: { website?: string; name?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } }; types?: string[] } };
        const parsed = parseGooglePlacesResults([body.result || {}], tile);
        withSites.push(parsed[0] || co);
      } catch {
        withSites.push(co);
      }
    }
    return withSites.filter((c) => c.website);
  } catch {
    return [];
  }
}

/**
 * One polite slice of Texas map discovery.
 * Uses OpenStreetMap Overpass (open data). Optional official Google Places API when a key is set.
 * Does not scrape the Google Maps website.
 */
export async function runMapDiscovery(opts: { maxTiles?: number; maxSites?: number } = {}): Promise<DiscoverStatus> {
  const maxTiles = opts.maxTiles ?? 1;
  const maxSites = opts.maxSites ?? 10;
  let status = loadDiscoverStatus();
  status = saveDiscoverStatus(
    nextDiscoverStatus(status, {
      running: true,
      note: "Scanning Texas map tiles for companies with public websites…",
    })
  );

  let sites = 0;
  for (let n = 0; n < maxTiles; n++) {
    const idx = status.tileIndex % TEXAS_MAP_TILES.length;
    const tile = TEXAS_MAP_TILES[idx];
    if (n > 0) await new Promise((r) => setTimeout(r, OVERPASS_MIN_MS));
    const osm = await fetchOverpassTile(tile);
    const places = await fetchGooglePlaces(tile);
    const companies = rankMapCompanies([...osm, ...places]);
    status = saveDiscoverStatus(
      nextDiscoverStatus(status, {
        tileIndex: idx + 1,
        companiesSeen: status.companiesSeen + companies.length,
        lastTile: tile.name,
      })
    );

    for (const co of companies) {
      if (sites >= maxSites) break;
      const rec = await inspectCompanyCareers(co, fetchHtml);
      sites += 1;
      if (!rec) continue;
      if (!rec.slug && rec.careersUrl) {
        const page = await fetchHtml(rec.careersUrl);
        const ats = page ? detectAtsInHtml(page, rec.careersUrl) : null;
        if (ats) {
          rec.board = ats.board;
          rec.slug = ats.slug;
        }
      }
      upsertEmployer(rec);
      status = saveDiscoverStatus(
        nextDiscoverStatus(status, {
          sitesChecked: status.sitesChecked + 1,
          mappedFeeds: rec.slug ? status.mappedFeeds + 1 : status.mappedFeeds,
        })
      );
    }
  }

  return saveDiscoverStatus(nextDiscoverStatus(status, { running: false }));
}

export { detectAtsInHtml };
