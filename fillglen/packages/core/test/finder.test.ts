import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyFeedback,
  assertRealListing,
  classifyWorkMode,
  coverage,
  dedupeListings,
  DEFAULT_SEARCH,
  detectBoardFromCareersUrl,
  expandTitles,
  feedMetaForUrl,
  geocodeLocation,
  haversineMiles,
  inferExperience,
  isBlockedJobUrl,
  isNonUsLocation,
  isTexasLocation,
  isUsLocation,
  listingDedupeKey,
  looksLikeItRole,
  ruleFilter,
  ruleScore,
  seedEmployers,
  warningSigns,
  type CanonicalListing,
} from "../src/finder.js";

function job(over: Partial<CanonicalListing> = {}): CanonicalListing {
  return {
    id: over.id || "j1",
    title: "IT Systems Analyst",
    company: "North Texas Mutual",
    locationText: "Carrollton, TX",
    lat: 32.9756,
    lng: -96.8897,
    workMode: "onsite",
    description: "Entry level systems analyst. Cybersecurity compliance and GRC. 1 year experience.",
    url: "https://boards.greenhouse.io/northtexmutual/jobs/123",
    source: "greenhouse",
    sources: [{ source: "greenhouse", url: "https://boards.greenhouse.io/northtexmutual/jobs/123" }],
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastCheckedAt: "2026-10-08T00:00:00.000Z",
    postedAt: "2026-10-01T00:00:00.000Z",
    status: "open",
    ...over,
  };
}

describe("real listing invariant", () => {
  it("rejects AI-invented rows without a source url", () => {
    assert.throws(() => assertRealListing({ title: "Engineer", company: "FakeCo" }), /never creates/);
  });
  it("blocks LinkedIn Indeed Glassdoor", () => {
    assert.equal(isBlockedJobUrl("https://www.linkedin.com/jobs/view/1"), true);
    assert.equal(isBlockedJobUrl("https://www.indeed.com/viewjob?jk=1"), true);
    assert.equal(isBlockedJobUrl("https://www.glassdoor.com/Job/1"), true);
    assert.equal(isBlockedJobUrl("https://boards.greenhouse.io/x/jobs/1"), false);
    assert.throws(() => assertRealListing(job({ url: "https://www.indeed.com/viewjob?jk=1" })));
  });
});

describe("geocode and radius", () => {
  it("maps DFW, Richardson, Plano, Carrollton to coordinates", () => {
    assert.ok(geocodeLocation("Dallas-Fort Worth Metroplex"));
    assert.ok(geocodeLocation("Richardson, TX"));
    assert.ok(geocodeLocation("Plano"));
    const c = geocodeLocation("Carrollton, TX");
    assert.ok(c);
    const dallas = geocodeLocation("Dallas, TX")!;
    assert.ok(haversineMiles(c!, dallas) < 25);
    const austin = geocodeLocation("Austin, TX, United States");
    assert.ok(austin);
    assert.ok(austin.lat < 31.5);
    assert.ok(geocodeLocation("Houston, TX"));
    assert.ok(geocodeLocation("Remote - Dallas, TX"));
    assert.ok(geocodeLocation("New York, NY"));
    assert.ok(geocodeLocation("San Francisco, CA"));
  });
  it("drops on-site jobs outside the radius", () => {
    const nyc = job({
      locationText: "New York, NY",
      lat: 40.7128,
      lng: -74.006,
      workMode: "onsite",
    });
    const r = ruleFilter(nyc, { ...DEFAULT_SEARCH, homeCity: "Carrollton, TX", radiusMiles: 20, remoteOk: false });
    assert.equal(r.pass, false);
    assert.match(r.reason || "", /radius|location/);
  });
  it("keeps remote when welcome", () => {
    const r = ruleFilter(job({ workMode: "remote", locationText: "Remote - US" }), DEFAULT_SEARCH);
    assert.equal(r.pass, true);
  });
  it("keeps Texas on-site IT jobs and drops non-US postings", () => {
    assert.equal(isTexasLocation("Austin, TX"), true);
    assert.equal(isUsLocation("New York, NY"), true);
    assert.equal(isNonUsLocation("London, UK"), true);
    const tx = ruleFilter(job({ locationText: "Houston, TX", lat: 29.76, lng: -95.37, workMode: "onsite" }), DEFAULT_SEARCH);
    assert.equal(tx.pass, true);
    const uk = ruleFilter(
      job({ locationText: "London, UK", lat: 51.5, lng: -0.1, workMode: "onsite", description: "Office in London, United Kingdom." }),
      DEFAULT_SEARCH
    );
    assert.equal(uk.pass, false);
  });
  it("drops no-sponsorship jobs when the user needs a visa", () => {
    const r = ruleFilter(
      job({ description: "Must be authorized to work. We cannot sponsor visas." }),
      { ...DEFAULT_SEARCH, needsSponsorship: true }
    );
    assert.equal(r.pass, false);
    assert.match(r.reason || "", /visa/);
  });
});

describe("dedupe", () => {
  it("merges the same company/title/location and keeps both source links", () => {
    const a = job({ source: "greenhouse" });
    const b = job({
      id: "j2",
      source: "lever",
      url: "https://jobs.lever.co/northtexmutual/abc",
      sources: [{ source: "lever", url: "https://jobs.lever.co/northtexmutual/abc" }],
    });
    const [one] = dedupeListings([a, b]);
    assert.equal(one.sources.length, 2);
    assert.equal(listingDedupeKey(a), listingDedupeKey(b));
  });
});

describe("rules and scoring", () => {
  it("expands IT systems into related titles", () => {
    const titles = expandTitles(["IT systems"]);
    assert.ok(titles.some((t) => t.includes("systems analyst")));
    assert.ok(titles.some((t) => t.includes("implementation specialist")));
  });
  it("treats a 5-year entry-level posting as too senior", () => {
    const r = ruleFilter(
      job({ title: "Entry Level Engineer", description: "5+ years of experience required." }),
      { ...DEFAULT_SEARCH, experienceLevel: "entry" }
    );
    assert.equal(r.pass, false);
  });
  it("scores a niche match and writes a why sentence", () => {
    const s = ruleScore(job(), DEFAULT_SEARCH);
    assert.ok(s.score >= 60);
    assert.ok(s.why.length > 10);
    assert.equal(s.via, "rules");
  });
  it("flags missing company and payment scams", () => {
    const w = warningSigns(job({ company: "Confidential", description: "Wire money for training fee" }));
    assert.ok(w.some((x) => /company/i.test(x)));
    assert.ok(w.some((x) => /payment/i.test(x)));
  });
  it("thumbs-down lowers the score", () => {
    const base = ruleScore(job(), DEFAULT_SEARCH).score;
    const next = applyFeedback(base, job(), [{ listingId: "j1", sentiment: "down", reason: "wrong industry" }]);
    assert.ok(next < base);
  });
});

describe("experience inference", () => {
  it("reads intern vs senior from copy", () => {
    assert.equal(inferExperience("summer intern program", "Intern"), "intern");
    assert.equal(inferExperience("7 years required", "Senior Engineer"), "senior");
  });
  it("classifies hybrid vs remote vs onsite", () => {
    assert.equal(classifyWorkMode("Eng", "Dallas", "hybrid 3 days"), "hybrid");
    assert.equal(classifyWorkMode("Eng", "Remote US", "fully remote"), "remote");
  });
});

describe("employer mapping", () => {
  it("attaches a feed score when the live window opens a sourced listing", () => {
    const meta = feedMetaForUrl("https://boards.greenhouse.io/northtexmutual/jobs/123", [
      { url: "https://boards.greenhouse.io/northtexmutual/jobs/123", score: 82, why: "Niche fit", source: "greenhouse" },
    ]);
    assert.equal(meta?.feedScore, 82);
    assert.equal(meta?.feedSource, "greenhouse");
  });
  it("parses greenhouse/lever/ashby careers URLs", () => {
    assert.deepEqual(detectBoardFromCareersUrl("https://boards.greenhouse.io/acme/jobs/1"), { board: "greenhouse", slug: "acme" });
    assert.deepEqual(detectBoardFromCareersUrl("https://jobs.lever.co/acme"), { board: "lever", slug: "acme" });
    assert.deepEqual(detectBoardFromCareersUrl("https://jobs.ashbyhq.com/acme"), { board: "ashby", slug: "acme" });
    assert.equal(detectBoardFromCareersUrl("https://apply.workable.com/acme")?.board, "workable");
    assert.equal(detectBoardFromCareersUrl("https://acme.wd5.myworkdaysite.com/careers")?.board, "workday");
  });
  it("reports DFW coverage honestly", () => {
    const c = coverage(seedEmployers(), seedEmployers(), "dfw");
    assert.ok(c.seedCount >= 1);
    assert.ok(c.unmapped.includes("American Airlines") || c.unmapped.includes("Texas Instruments") || c.mappedCount < c.seedCount);
    assert.match(c.note, /every job/i);
  });
  it("seeds Texas-preferring US IT employers with public feeds", () => {
    const seed = seedEmployers();
    assert.ok(seed.some((e) => e.company === "Tesla" && e.board === "greenhouse"));
    assert.ok(seed.some((e) => e.company === "CrowdStrike" && e.slug === "crowdstrike"));
    assert.ok(seed.some((e) => /american airlines|texas instruments|dell/i.test(e.company) && e.board === "unknown"));
    assert.ok(looksLikeItRole("Software Engineer"));
    assert.ok(looksLikeItRole("IT Support Specialist"));
    assert.equal(looksLikeItRole("Barista"), false);
  });
});
