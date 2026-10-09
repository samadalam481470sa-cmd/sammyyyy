import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.FILLGLEN_DATA = path.join(mkdtempSync(path.join(os.tmpdir(), "fg-")), "db.json");
process.env.FILLGLEN_SECRET = "test-secret";
process.env.FINDER_SCHEDULE = "0";
process.env.FILLGLEN_AI_PROVIDER = "none";

const { app } = await import("../src/server.ts");
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;
const base = `http://127.0.0.1:${port}`;

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json() };
}

describe("Fillglen API", () => {
  let token = "";
  it("health", async () => {
    const r = await json(`${base}/health`);
    assert.equal(r.body.ok, true);
  });
  it("magic link issues a hashed session", async () => {
    const r = await json(`${base}/v1/auth/magic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sam@fillglen.test" }),
    });
    assert.equal(r.status, 200);
    token = r.body.token;
    assert.ok(token);
  });
  it("rejects bad email", async () => {
    const r = await json(`${base}/v1/auth/magic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nope" }),
    });
    assert.equal(r.status, 400);
  });
  it("AI draft refuses self-id without calling a model", async () => {
    const r = await json(`${base}/v1/ai/draft`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: "Gender?", type: "gender", jobTitle: "E", company: "C", jobDescription: "" }),
    });
    assert.equal(r.body.refused, true);
  });
  it("match score explains itself", async () => {
    const r = await json(`${base}/v1/match`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: "Required: TypeScript" }),
    });
    assert.match(r.body.explanation, /not a prediction/i);
  });
  it("local finder scores a real sourced listing and refuses invented rows", async () => {
    const { upsertListing } = await import("../src/finder/pipeline.ts");
    upsertListing({
      id: "gh-test-1",
      title: "IT Systems Analyst",
      company: "North Texas Mutual",
      locationText: "Carrollton, TX",
      lat: 32.9756,
      lng: -96.8897,
      workMode: "onsite",
      description: "Entry level systems analyst. Cybersecurity compliance.",
      url: "https://boards.greenhouse.io/northtexmutual/jobs/123",
      source: "greenhouse",
      sources: [{ source: "greenhouse", url: "https://boards.greenhouse.io/northtexmutual/jobs/123" }],
      firstSeenAt: "2026-10-01T00:00:00.000Z",
      lastCheckedAt: "2026-10-08T00:00:00.000Z",
      status: "open",
    });
    const jobs = await json(`${base}/v1/finder/jobs`, { headers: { authorization: `Bearer ${token}` } });
    assert.ok(jobs.body.jobs.length >= 1);
    assert.ok(jobs.body.jobs[0].url);
    assert.ok(jobs.body.jobs[0].source);
    assert.ok(jobs.body.jobs[0].firstSeenAt);
    assert.ok(jobs.body.coverage.note);
    const mcp = await json(`${base}/v1/mcp/search_local_jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: "cybersecurity", city: "Carrollton, TX", radiusMiles: 20 }),
    });
    assert.ok(mcp.body.listings.some((l: { url: string }) => l.url.includes("greenhouse")));
    const mapped = await json(`${base}/v1/finder/employers`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ company: "Acme", careersUrl: "https://jobs.lever.co/acme" }),
    });
    assert.equal(mapped.body.board, "lever");
    assert.equal(mapped.body.slug, "acme");
  });
  it("in-app database ingest and search", async () => {
    const ingest = await json(`${base}/v1/database/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        records: [
          {
            id: "job:https://boards.greenhouse.io/ntm/jobs/55",
            kind: "job",
            title: "IT Systems Analyst",
            company: "North Texas Mutual",
            url: "https://boards.greenhouse.io/ntm/jobs/55",
            location: "Carrollton, TX",
            source: "greenhouse",
            score: 88,
            why: "Texas IT",
            status: "open",
            firstSeenAt: "2026-10-01T00:00:00.000Z",
            lastSeenAt: "2026-10-08T00:00:00.000Z",
            text: "it systems analyst north texas mutual carrollton",
            meta: {},
          },
        ],
      }),
    });
    assert.equal(ingest.body.ok, true);
    assert.ok(ingest.body.total >= 1);
    const search = await json(`${base}/v1/database/search?q=analyst&kind=job`);
    assert.ok(search.body.total >= 1);
    assert.equal(search.body.rows[0].company, "North Texas Mutual");
    const stats = await json(`${base}/v1/database/stats`);
    assert.ok(stats.body.total >= 1);
    const one = await json(`${base}/v1/database/record/${encodeURIComponent("job:https://boards.greenhouse.io/ntm/jobs/55")}`);
    assert.equal(one.body.title, "IT Systems Analyst");
  });
  it("export and delete account", async () => {
    const exp = await json(`${base}/v1/export`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(exp.body.user.email, "sam@fillglen.test");
    const del = await json(`${base}/v1/account`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    assert.equal(del.body.ok, true);
  });
});

after(() => server.close());
