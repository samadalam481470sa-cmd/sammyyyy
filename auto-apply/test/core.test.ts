import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate DB before importing db module
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "auto-apply-"));
process.env.DATA_DIR = tmp;
fs.mkdirSync(path.join(tmp, "config"), { recursive: true });
fs.copyFileSync(
  path.join(__dirname, "../config/rules.json"),
  path.join(tmp, "config", "rules.json")
);
fs.copyFileSync(
  path.join(__dirname, "../src/queue/schema.sql"),
  path.join(tmp, "schema-link-placeholder")
);
// schema is loaded from __dirname of db.ts which is src/queue — fine in source mode via tsx

import { matchField, needsPause } from "../src/filler/fieldMap";
import { scoreJob, loadRules } from "../src/matching/score";
import { insertIfNew, matchNewJobs, nextJob, saveApprovedAnswer, findSavedAnswer, setStatus } from "../src/queue/db";
import type { Job } from "../src/discovery/types";

test("field map prefers longest synonym", () => {
  assert.equal(matchField("Legal First Name"), "firstName");
  assert.equal(matchField("Email Address"), "email");
  assert.equal(matchField("LinkedIn Profile URL"), "linkedin");
  assert.ok(needsPause("Are you authorized to work in the US?"));
  assert.ok(needsPause("Salary expectations"));
  assert.equal(needsPause("What interests you about this role?"), false);
});

test("scoreJob filters and ranks", () => {
  const rules = loadRules();
  const good: Job = {
    id: "1",
    company: "Acme",
    title: "Software Engineer",
    location: "Dallas, TX",
    url: "https://example.com/1",
    description: "Python SQL AWS cloud security experience required",
    ats: "greenhouse",
  };
  const senior: Job = { ...good, id: "2", title: "Senior Software Engineer" };
  const sales: Job = { ...good, id: "3", title: "Account Executive", description: "quota" };
  assert.ok(scoreJob(good, rules) >= rules.minScore);
  assert.equal(scoreJob(senior, rules), 0);
  assert.equal(scoreJob(sales, rules), 0);
});

test("queue insert, match, approve flow", () => {
  const job: Job = {
    id: "gh-test-1",
    company: "TestCo",
    title: "Data Analyst",
    location: "Remote",
    url: "https://example.com/job/1",
    description: "sql python tableau aws",
    ats: "greenhouse",
  };
  assert.equal(insertIfNew(job), true);
  assert.equal(insertIfNew(job), false, "duplicate ignored");

  const rules = loadRules();
  const n = matchNewJobs((j) => scoreJob(j, rules), rules.minScore);
  assert.ok(n >= 1);

  const next = nextJob();
  assert.ok(next);
  assert.equal(next!.job.id, job.id);

  setStatus(job.id, "approved");
  const approved = nextJob();
  assert.ok(approved?.approved);

  saveApprovedAnswer("Are you authorized to work?", "Yes");
  assert.equal(findSavedAnswer("are you authorized to work in the united states?"), "Yes");
});
