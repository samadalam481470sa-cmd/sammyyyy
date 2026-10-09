import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCAL_DB_CAP,
  answerRecord,
  applicationRecord,
  compactDbCache,
  dbStats,
  employerRecord,
  harvestRecord,
  isDbRecord,
  jobRecord,
  listingRecord,
  mergeRecord,
  parseDbQuery,
  putLocalRecords,
  queryLocalStore,
  queryRecords,
  recordId,
  resetMemoryStore,
  seedEmployerRecords,
  trimRecords,
  upsertRecords,
} from "../src/index.js";

describe("local database", () => {
  it("builds stable ids and searchable job records", () => {
    const row = jobRecord({
      url: "https://boards.greenhouse.io/acme/jobs/1?gh_src=x",
      title: "IT Systems Analyst",
      company: "Acme",
      location: "Dallas, TX",
      source: "greenhouse",
      score: 82,
      why: "Texas IT title",
    });
    assert.equal(row.kind, "job");
    assert.match(row.id, /^job:/);
    assert.equal(row.id, recordId("job", "https://boards.greenhouse.io/acme/jobs/1"));
    assert.match(row.text, /analyst/);
    assert.equal(isDbRecord(row), true);
  });

  it("upserts without dropping firstSeenAt or appliedAt", () => {
    const a = jobRecord({
      url: "https://jobs.lever.co/n/1",
      title: "Help Desk",
      company: "North Glen",
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      appliedAt: "2026-01-02T00:00:00.000Z",
    });
    const b = jobRecord({
      url: "https://jobs.lever.co/n/1",
      title: "IT Help Desk",
      company: "North Glen",
      lastSeenAt: "2026-02-01T00:00:00.000Z",
      score: 70,
    });
    const [merged] = upsertRecords([a], [b]);
    assert.equal(merged.title, "IT Help Desk");
    assert.equal(merged.firstSeenAt, "2026-01-01T00:00:00.000Z");
    assert.equal(merged.appliedAt, "2026-01-02T00:00:00.000Z");
    assert.equal(merged.score, 70);
  });

  it("finds records with every token and paginates", () => {
    const records = [
      jobRecord({ url: "https://a.example/1", title: "Cybersecurity analyst", company: "Mutual", location: "Carrollton, TX", source: "greenhouse", score: 90 }),
      jobRecord({ url: "https://a.example/2", title: "Retail clerk", company: "Shop", location: "Austin, TX", source: "lever", score: 10 }),
      employerRecord({ company: "Mutual", metro: "dfw", careersUrl: "https://boards.greenhouse.io/mutual", board: "greenhouse", slug: "mutual", sourceKind: "seed" }),
    ];
    const found = queryRecords(records, { q: "cyber carrollton", kind: "job", minScore: 50, limit: 10 });
    assert.equal(found.total, 1);
    assert.equal(found.rows[0].title, "Cybersecurity analyst");
    const page = queryRecords(records, { sort: "title", dir: "asc", limit: 1, offset: 1 });
    assert.equal(page.total, 3);
    assert.equal(page.rows.length, 1);
    assert.equal(found.stats.total, 3);
    assert.equal(found.stats.companies >= 2, true);
  });

  it("parses widget and URL queries", () => {
    const q = parseDbQuery({ q: "python dallas", kind: "job,employer", applied: "false", limit: "25", sort: "score" });
    assert.equal(q.q, "python dallas");
    assert.deepEqual(q.kind, ["job", "employer"]);
    assert.equal(q.applied, false);
    assert.equal(q.limit, 25);
    assert.equal(q.sort, "score");
    const fromSearch = parseDbQuery(new URLSearchParams("q=analyst&kind=job&dir=asc"));
    assert.equal(fromSearch.q, "analyst");
    assert.equal(fromSearch.kind, "job");
    assert.equal(fromSearch.dir, "asc");
  });

  it("keeps applied rows when trimming past the cap", () => {
    const records = [];
    for (let i = 0; i < 30; i++) {
      records.push(
        harvestRecord({ at: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`, fetched: i, via: "test" })
      );
    }
    records.push(
      jobRecord({
        url: "https://keep.example/applied",
        title: "Kept",
        company: "Keep Co",
        appliedAt: "2026-03-01T00:00:00.000Z",
      })
    );
    const trimmed = trimRecords(records, 8);
    assert.equal(trimmed.length, 8);
    assert.ok(trimmed.some((r) => r.url.includes("keep.example")));
    assert.ok(LOCAL_DB_CAP >= 8);
  });

  it("turns listings, harvests, applications, and answers into records", () => {
    const listing = listingRecord({
      id: "gh-1",
      title: "Systems Administrator",
      company: "North Texas Mutual",
      locationText: "Dallas, TX",
      lat: 32.7,
      lng: -96.8,
      workMode: "hybrid",
      description: "IT operations",
      url: "https://boards.greenhouse.io/ntm/jobs/9",
      source: "greenhouse",
      sources: [{ source: "greenhouse", url: "https://boards.greenhouse.io/ntm/jobs/9" }],
      firstSeenAt: "2026-10-01T00:00:00.000Z",
      lastCheckedAt: "2026-10-08T00:00:00.000Z",
      status: "open",
    });
    const harvest = harvestRecord({ fetched: 12, stored: 8, closed: 1, maps: 3, via: "api" });
    const app = applicationRecord({
      id: "a1",
      title: "Systems Administrator",
      company: "North Texas Mutual",
      url: listing.url,
      status: "saved",
    });
    const ans = answerRecord({ pattern: "how did you hear", answer: "Company careers page" });
    const stats = dbStats([listing, harvest, app, ans]);
    assert.equal(stats.byKind.job, 1);
    assert.equal(stats.harvestCount, 1);
    assert.ok(stats.lastHarvestAt);
    assert.equal(compactDbCache(stats).total, 4);
    assert.equal(mergeRecord(listing, { ...listing, score: 55 }).score, 55);
  });

  it("loads the built-in employer seed into records without a website", () => {
    const rows = seedEmployerRecords();
    assert.ok(rows.length >= 50);
    assert.ok(rows.every((r) => r.kind === "employer" && r.company));
    const found = queryRecords(rows, { q: "greenhouse", kind: "employer", limit: 10 });
    assert.ok(found.total >= 1);
  });

  it("hides EEO and contact saved answers from Database browse", () => {
    const eeo = answerRecord({ pattern: "gender identity", answer: "Male", tags: ["eeo"] });
    const zip = answerRecord({ pattern: "zip code", answer: "75006", tags: ["contact"] });
    const keep = answerRecord({ pattern: "how did you hear", answer: "Company careers page" });
    const job = jobRecord({ url: "https://jobs.example/1", title: "SWE", company: "Acme" });
    const all = queryRecords([eeo, zip, keep, job], { limit: 20 });
    assert.equal(all.rows.some((r) => r.kind === "answer"), false);
    assert.equal(all.rows[0].kind, "job");
    const answers = queryRecords([eeo, zip, keep, job], { kind: "answer", limit: 20 });
    assert.equal(answers.rows.length, 1);
    assert.equal(answers.rows[0].title, "how did you hear");
  });

  it("memory IndexedDB fallback upserts and queries", async () => {
    resetMemoryStore();
    await putLocalRecords([
      jobRecord({ url: "https://jobs.ashbyhq.com/x/1", title: "Network engineer", company: "Glen IT", location: "Texas" }),
    ]);
    const found = await queryLocalStore({ q: "network texas" });
    assert.equal(found.total, 1);
    assert.equal(found.rows[0].company, "Glen IT");
    resetMemoryStore();
  });
});
