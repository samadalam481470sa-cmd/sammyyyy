/**
 * Read-only MCP-style connector for the local job database.
 * Searching still happens on the server worker. This only answers questions
 * about listings already fetched.
 */
import { DEFAULT_SEARCH, geocodeLocation, haversineMiles } from "@fillglen/core";
import { allListings } from "./finder/pipeline.js";

export const MCP_TOOLS = [
  {
    name: "search_local_jobs",
    description: "Search Fillglen's already-fetched local job database. Does not invent listings or scrape LinkedIn/Indeed/Glassdoor.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        city: { type: "string" },
        radiusMiles: { type: "number" },
      },
      required: ["query"],
    },
  },
];

export function searchLocalJobs(input: { query: string; city?: string; radiusMiles?: number }) {
  const city = input.city || DEFAULT_SEARCH.homeCity;
  const radius = input.radiusMiles ?? 20;
  const home = geocodeLocation(city, "dfw") || geocodeLocation(city, "austin");
  const q = input.query.toLowerCase();
  return allListings()
    .filter((j) => j.status === "open")
    .filter((j) => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q) || q.split(/\s+/).some((w) => j.title.toLowerCase().includes(w)))
    .filter((j) => {
      if (j.workMode === "remote") return true;
      if (!home || j.lat == null || j.lng == null) return true;
      return haversineMiles(home, { lat: j.lat, lng: j.lng }) <= radius;
    })
    .slice(0, 20)
    .map((j) => ({
      title: j.title,
      company: j.company,
      url: j.url,
      source: j.source,
      location: j.locationText,
      firstSeenAt: j.firstSeenAt,
      lastCheckedAt: j.lastCheckedAt,
    }));
}
