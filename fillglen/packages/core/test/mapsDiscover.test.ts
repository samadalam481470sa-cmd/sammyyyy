import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_DISCOVER,
  TEXAS_MAP_TILES,
  commonCareerPaths,
  detectAtsInHtml,
  discoverNote,
  extractCareerLinks,
  googlePlacesQuery,
  looksLikeItCompany,
  normalizeWebsite,
  overpassQuery,
  parseGooglePlacesResults,
  parseOverpassElements,
  rankJobsForResume,
  resumeSearchHints,
  settingsFromResume,
} from "../src/index.js";
import { parseResumeText } from "../src/parseResume.js";
import { inspectCompanyCareers } from "../src/mapsDiscover.js";
import { EMPTY_PROFILE } from "../src/types.js";

describe("Texas map tiles", () => {
  it("covers DFW Austin Houston and a near-Texas tile", () => {
    const ids = TEXAS_MAP_TILES.map((t) => t.id);
    assert.ok(ids.includes("dfw"));
    assert.ok(ids.includes("austin"));
    assert.ok(ids.includes("houston"));
    assert.ok(ids.includes("shreveport"));
    assert.ok(TEXAS_MAP_TILES.every((t) => t.north > t.south && t.east > t.west));
  });
  it("builds an Overpass query with the tile bbox", () => {
    const q = overpassQuery(TEXAS_MAP_TILES[0]);
    assert.match(q, /office/);
    assert.match(q, /website/);
    assert.match(q, /32\.35/);
  });
  it("writes a Places text query for the tile", () => {
    assert.match(googlePlacesQuery(TEXAS_MAP_TILES[1]), /Austin/);
  });
  it("mentions the extra government and filings layer in the scan note", () => {
    const note = discoverNote({ ...EMPTY_DISCOVER, companiesSeen: 2, govJobs: 5, recordsCompanies: 3 });
    assert.match(note, /government postings/);
    assert.match(note, /filings/);
  });
});

describe("map company parsing", () => {
  it("reads OSM elements with websites and ranks IT names first", () => {
    const tile = TEXAS_MAP_TILES[0];
    const rows = parseOverpassElements(
      [
        { lat: 32.8, lon: -96.8, tags: { name: "Joe's Cafe", website: "https://joescafe.example", office: "company" } },
        { lat: 32.9, lon: -96.9, tags: { name: "Glen Cyber IT", website: "glencyber.example", office: "it" } },
      ],
      tile
    );
    assert.equal(rows[0].name, "Glen Cyber IT");
    assert.equal(rows[0].website.startsWith("https://"), true);
    assert.equal(looksLikeItCompany("Glen Cyber IT", ["it"]), true);
    assert.equal(looksLikeItCompany("Joe's Cafe", ["company"]), false);
  });
  it("parses Google Places results without scraping Maps HTML", () => {
    const rows = parseGooglePlacesResults(
      [
        {
          name: "Austin Software Co",
          website: "https://austinsoftware.example",
          geometry: { location: { lat: 30.2, lng: -97.7 } },
          types: ["point_of_interest"],
        },
      ],
      TEXAS_MAP_TILES[1]
    );
    assert.equal(rows[0].source, "google-places");
    assert.equal(rows[0].metro, "austin");
  });
});

describe("career page detection", () => {
  it("extracts careers hrefs and detects Greenhouse in page HTML", () => {
    const html = `<a href="/careers">Jobs</a><iframe src="https://boards.greenhouse.io/acme/jobs/1"></iframe>`;
    const links = extractCareerLinks(html, "https://acme.example");
    assert.ok(links.some((l) => /careers/.test(l)));
    const ats = detectAtsInHtml(html, "https://acme.example/careers");
    assert.equal(ats?.board, "greenhouse");
    assert.ok(commonCareerPaths("https://acme.example").includes("https://acme.example/careers"));
  });
  it("inspects a company site via the fetch callback", async () => {
    const rec = await inspectCompanyCareers(
      {
        name: "Acme IT",
        website: "https://acme.example",
        lat: 30,
        lng: -97,
        tags: ["it"],
        source: "openstreetmap",
        metro: "austin",
      },
      async (url) => {
        if (url === "https://acme.example") return `<a href="https://jobs.lever.co/acme">Careers</a>`;
        return null;
      }
    );
    assert.equal(rec?.board, "lever");
    assert.equal(rec?.slug, "acme");
  });
  it("normalizes websites and skips empty", () => {
    assert.equal(normalizeWebsite("www.acme.example/jobs/"), "https://www.acme.example/jobs");
    assert.equal(normalizeWebsite(""), "");
  });
});

describe("resume tailored ranking", () => {
  it("parses skills and IT titles from a pasted resume", () => {
    const p = parseResumeText(`Sam Glen
sam@fillglen.test
Carrollton, TX
Software Engineer at North Glen Labs
Skills: TypeScript, React, PostgreSQL
`);
    assert.equal(p.contact.email, "sam@fillglen.test");
    assert.equal(p.contact.city, "Carrollton");
    assert.ok(p.skills.some((s) => /typescript/i.test(s.name)));
    assert.ok(p.work.some((w) => /software engineer/i.test(w.title)));
    const hints = resumeSearchHints(p);
    assert.ok(hints.titles.some((t) => /software engineer/i.test(t)));
  });
  it("ranks a matching Texas IT job above an unrelated title", () => {
    const profile = parseResumeText("Sam\nIT Systems Analyst\nSkills: cybersecurity, GRC\n");
    const ranked = rankJobsForResume(
      [
        { url: "https://boards.greenhouse.io/a/1", title: "Barista", company: "Cafe", location: "Austin, TX" },
        { url: "https://boards.greenhouse.io/a/2", title: "IT Systems Analyst", company: "CrowdStrike", location: "Austin, TX" },
      ],
      profile
    );
    assert.equal(ranked[0].title, "IT Systems Analyst");
    assert.ok((ranked[0].score || 0) > (ranked[1].score || 0));
  });
  it("merges resume titles into search settings", () => {
    const s = settingsFromResume({ ...EMPTY_PROFILE, work: [{ id: "1", company: "X", title: "Help Desk Technician", startDate: "", endDate: "", location: "", bullets: [] }] });
    assert.ok(s.titles.some((t) => /help desk/i.test(t)));
  });
});
