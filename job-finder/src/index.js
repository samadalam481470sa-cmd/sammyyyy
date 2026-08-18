#!/usr/bin/env node
/**
 * Scheduled job-discovery run.
 *
 * Fetches postings from officially public job APIs, scores each against the
 * resume with the same logic the Chrome extension uses, writes a ranked
 * shortlist plus per-job cover-letter drafts, and (optionally) pings a
 * webhook.
 *
 * It deliberately stops at discovery + preparation. It does not submit
 * applications, create accounts, or log into any job board — you open the
 * links it produces and apply yourself (the browser extension makes that
 * fast).
 */
const fs = require("node:fs");
const path = require("node:path");

const { loadConfig, loadResumeText, ROOT } = require("./config");
const { SOURCES_BY_ID } = require("./sources");
const { scoreJobs } = require("./score");
const { writeOutputs, sendWebhook } = require("./report");

const CACHE_DIR = path.join(ROOT, ".cache");
const SEEN_PATH = path.join(CACHE_DIR, "seen.json");
const OUTPUT_DIR = path.join(ROOT, "output");

function loadSeenIds() {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SEEN_PATH, "utf8"));
      return new Set(parsed.ids || []);
    }
  } catch (err) {
    console.warn(`Could not read seen-cache (${err.message}); treating everything as new.`);
  }
  return new Set();
}

function saveSeenIds(ids) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Keep the cache bounded so it doesn't grow forever across scheduled runs.
  const bounded = Array.from(ids).slice(-5000);
  fs.writeFileSync(SEEN_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), ids: bounded }, null, 2));
}

async function main() {
  const config = loadConfig();
  const resumeText = loadResumeText();

  const enabledSourceIds = Object.entries(config.sources)
    .filter(([, sourceConfig]) => sourceConfig && sourceConfig.enabled)
    .map(([id]) => id);

  if (enabledSourceIds.length === 0) {
    throw new Error("No sources enabled in config.json — enable at least one under `sources`.");
  }

  console.log(`Fetching from ${enabledSourceIds.length} source(s): ${enabledSourceIds.join(", ")}`);

  const allJobs = [];
  const sourcesSucceeded = [];
  const sourcesFailed = [];
  const attributions = [];

  // Sources run sequentially: it's a background job, and being gentle with
  // third-party APIs matters more than shaving seconds off the runtime.
  for (const id of enabledSourceIds) {
    const source = SOURCES_BY_ID[id];
    if (!source) {
      sourcesFailed.push({ id, error: "unknown source id" });
      console.warn(`Skipping unknown source "${id}"`);
      continue;
    }
    try {
      const jobs = await source.fetchJobs(config.sources[id] || {});
      allJobs.push(...jobs);
      sourcesSucceeded.push(id);
      if (source.attribution) attributions.push(source.attribution);
      console.log(`  ${source.label}: ${jobs.length} posting(s)`);
    } catch (err) {
      sourcesFailed.push({ id, error: err.message });
      console.warn(`  ${source.label}: FAILED — ${err.message}`);
    }
  }

  if (sourcesSucceeded.length === 0) {
    throw new Error("Every enabled source failed — see the warnings above.");
  }

  const { profile, matches } = scoreJobs(allJobs, resumeText, config.filters);

  const seenIds = loadSeenIds();
  let newCount = 0;
  for (const job of matches) {
    job.isNew = !seenIds.has(job.id);
    if (job.isNew) newCount++;
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    totalFetched: allJobs.length,
    sourcesSucceeded,
    sourcesFailed,
    attributions,
    filters: config.filters,
    newCount,
    profile,
  };

  const { draftCount, tailoredCount } = writeOutputs(OUTPUT_DIR, matches, meta, config);

  matches.forEach((job) => seenIds.add(job.id));
  saveSeenIds(seenIds);

  const webhookSent = await sendWebhook(matches, meta);

  console.log("");
  console.log(`Scanned ${allJobs.length} posting(s); ${matches.length} cleared your filters (${newCount} new).`);
  console.log(
    `Wrote ${path.relative(process.cwd(), OUTPUT_DIR)}/: matches.md, matches.json, ` +
      `${draftCount} cover-letter draft(s), ${tailoredCount} tailored-resume plan(s).`
  );
  if (webhookSent) console.log("Posted summary to JOB_ALERT_WEBHOOK.");
  console.log("");
  console.log("Next step is yours: open the links, review each posting, and submit the applications you actually want.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nJob discovery failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
