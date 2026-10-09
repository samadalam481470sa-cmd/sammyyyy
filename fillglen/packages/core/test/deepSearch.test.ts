import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companySlugGuesses,
  detectBoardFromCareersUrl,
  govEmployerSeed,
  looksLikeBogusJob,
  looksLikeGovItRole,
  parseDirectoryCompanies,
  parseGovernmentJobsHtml,
  parseJobPostingLd,
  parseSecSearchHits,
  parseUsaJobsApi,
  parseUsaJobsSearchHtml,
  parseUsaSpendingAwards,
  queueItemToListing,
  seedEmployerRecords,
  uniqueSolidJobs,
} from "../src/index.js";

const GOV_HTML = `
<html><body>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"JobPosting","title":"IT Systems Analyst","url":"https://www.governmentjobs.com/careers/dallas/jobs/4411223/it-systems-analyst","hiringOrganization":{"name":"City of Dallas"},"jobLocation":{"@type":"Place","address":{"addressLocality":"Dallas","addressRegion":"TX","addressCountry":"US"}}}
</script>
<a href="/careers/dallas/jobs/4411999/cybersecurity-specialist">Cybersecurity Specialist</a>
<a href="/careers/dallas/jobs/12/lifeguard">Lifeguard</a>
<a href="https://www.indeed.com/viewjob?jk=1">Fake mill</a>
</body></html>
`;

const USA_HTML = `
<a href="https://www.usajobs.gov/job/812345678">Information Technology Specialist</a>
<a href="https://www.usajobs.gov/job/812345678">Information Technology Specialist</a>
<a href="https://www.usajobs.gov/job/9">Clerk</a>
`;

describe("government job parsers", () => {
  it("reads NeoGov JSON-LD and IT links, drops unrelated and mill URLs", () => {
    const jobs = parseGovernmentJobsHtml(GOV_HTML, "dallas", "City of Dallas");
    assert.ok(jobs.some((j) => /systems analyst/i.test(j.title)));
    assert.ok(jobs.some((j) => /cybersecurity/i.test(j.title)));
    assert.equal(jobs.some((j) => /lifeguard/i.test(j.title)), false);
    assert.equal(jobs.some((j) => /indeed/i.test(j.url)), false);
    assert.ok(jobs.every((j) => j.source === "governmentjobs"));
    assert.ok(jobs.every((j) => j.company === "City of Dallas"));
  });

  it("parses USAJOBS search HTML and the official search API shape", () => {
    const html = parseUsaJobsSearchHtml(USA_HTML);
    assert.equal(html.length, 1);
    assert.equal(html[0].url, "https://www.usajobs.gov/job/812345678");
    const api = parseUsaJobsApi({
      SearchResult: {
        SearchResultItems: [
          {
            MatchedObjectDescriptor: {
              PositionTitle: "IT Specialist (SYSADMIN)",
              PositionURI: "https://www.usajobs.gov/job/1001",
              OrganizationName: "Department of Veterans Affairs",
              PositionLocationDisplay: "Dallas, Texas",
            },
          },
          {
            MatchedObjectDescriptor: {
              PositionTitle: "Cook",
              PositionURI: "https://www.usajobs.gov/job/1002",
              OrganizationName: "VA",
              PositionLocationDisplay: "Austin, Texas",
            },
          },
        ],
      },
    });
    assert.equal(api.length, 1);
    assert.match(api[0].title, /IT Specialist/);
  });

  it("detects governmentjobs and usajobs career URLs", () => {
    const neo = detectBoardFromCareersUrl("https://www.governmentjobs.com/careers/austintexas");
    assert.deepEqual(neo, { board: "governmentjobs", slug: "austintexas" });
    const usa = detectBoardFromCareersUrl("https://www.usajobs.gov/Search/Results?k=it");
    assert.equal(usa?.board, "usajobs");
  });

  it("seeds Texas city/county boards without replacing the private ATS seed", () => {
    const gov = govEmployerSeed();
    assert.ok(gov.some((e) => e.company === "City of Dallas" && e.slug === "dallas"));
    assert.ok(gov.some((e) => e.company === "USAJOBS"));
    const db = seedEmployerRecords();
    assert.ok(db.some((r) => r.company === "City of Austin"));
    assert.ok(db.some((r) => r.company === "Match Group" || /greenhouse|lever/i.test(r.source)));
  });
});

describe("public filings and directories", () => {
  it("reads SEC full-text hits into unique company names", () => {
    const hits = parseSecSearchHits({
      hits: {
        hits: [
          {
            _id: "0000320193-26-000001:primary",
            _source: {
              display_names: ["North Texas Cloud Inc."],
              tickers: ["NTCL"],
              ciks: ["0000320193"],
              file_date: "2026-09-15",
              form_type: "8-K",
            },
          },
          {
            _source: {
              entity_name: "North Texas Cloud Inc.",
              tickers: ["NTCL"],
            },
          },
        ],
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].company, "North Texas Cloud Inc.");
    assert.match(hits[0].url, /sec\.gov/);
  });

  it("reads USAspending award recipients", () => {
    const rows = parseUsaSpendingAwards({
      results: [
        { "Recipient Name": "Glen IT Services LLC" },
        { recipient_name: "Glen IT Services LLC" },
        { "Recipient Name": "Austin Cyber Corp" },
      ],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].company, "Glen IT Services LLC");
  });

  it("guesses ATS slugs from a filing name", () => {
    const slugs = companySlugGuesses("The Acme Cloud Corporation");
    assert.ok(slugs.includes("acmecloud"));
  });

  it("pulls company websites from a city economic-development page", () => {
    const html = `<a href="https://www.acmecloud.example/careers">Acme Cloud</a><a href="https://privacy.example">Privacy</a>`;
    const rows = parseDirectoryCompanies(html, "https://www.dallas-ecodev.org/", "dfw");
    assert.ok(rows.some((r) => r.name === "Acme Cloud"));
    assert.equal(rows.some((r) => /privacy/i.test(r.website)), false);
  });
});

describe("solid job gate", () => {
  it("rejects mill, mailto, and unnamed postings", () => {
    assert.equal(
      looksLikeBogusJob({
        title: "IT Support",
        company: "Acme",
        url: "https://www.indeed.com/viewjob?jk=1",
      }),
      true
    );
    assert.equal(
      looksLikeBogusJob({
        title: "Work from phone make $500 a day",
        company: "CashNow",
        url: "https://cashnow.example/apply",
      }),
      true
    );
    assert.equal(
      looksLikeBogusJob({
        title: "Help Desk Technician",
        company: "City of Plano",
        url: "https://www.governmentjobs.com/careers/plano/jobs/1/help-desk-technician",
      }),
      false
    );
  });

  it("keeps IT specialist titles used on government boards", () => {
    assert.equal(looksLikeGovItRole("IT Specialist (SYSADMIN)"), true);
    assert.equal(looksLikeGovItRole("Computer Scientist"), true);
    assert.equal(looksLikeGovItRole("Lifeguard"), false);
  });

  it("canonical listings still require a real source URL", () => {
    const listing = queueItemToListing({
      url: "https://www.governmentjobs.com/careers/houston/jobs/9/network-engineer",
      title: "Network Engineer",
      company: "City of Houston",
      source: "governmentjobs",
      location: "Houston, TX",
    });
    assert.equal(listing.source, "governmentjobs");
    assert.ok(listing.firstSeenAt);
  });

  it("dedupes the extra research layer", () => {
    const rows = uniqueSolidJobs(
      [
        {
          url: "https://www.governmentjobs.com/careers/dallas/jobs/1/it-support?utm=1",
          title: "IT Support Specialist",
          company: "City of Dallas",
          source: "governmentjobs",
        },
        {
          url: "https://www.governmentjobs.com/careers/dallas/jobs/1/it-support",
          title: "IT Support Specialist",
          company: "City of Dallas",
          source: "governmentjobs",
        },
        {
          url: "https://www.indeed.com/viewjob?jk=nope",
          title: "IT Support",
          company: "Spam",
          source: "indeed",
        },
      ],
      10
    );
    assert.equal(rows.length, 1);
  });

  it("parses a JobPosting graph", () => {
    const jobs = parseJobPostingLd(
      `<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","name":"Help Desk Technician","url":"https://www.governmentjobs.com/careers/frisco/jobs/2/help-desk"}]}</script>`,
      "City of Frisco",
      "governmentjobs"
    );
    assert.equal(jobs[0].title, "Help Desk Technician");
  });
});
