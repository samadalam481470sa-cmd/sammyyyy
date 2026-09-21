#!/usr/bin/env node
/**
 * Black-box audit of the deployed TheNetTicket site.
 *
 * Everything here is observable from the outside: HTTP responses, the rendered DOM,
 * the browser console, the generated service worker and the runtime config the server
 * serialises into each page. No credentials and no repository access are required.
 *
 * Usage: node audit.mjs [--base https://host] [--out ./out] [--quiet]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FindingList } from './lib/findings.mjs';
import { runHttpChecks } from './lib/http-checks.mjs';
import { auditRoutes } from './lib/page-checks.mjs';
import { inspectServiceWorker, runOfflineChecks } from './lib/offline-checks.mjs';
import { toMarkdown, printSummary } from './lib/report.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const config = JSON.parse(readFileSync(resolve(here, 'audit.config.json'), 'utf8'));
const baseUrl = arg('base', process.env.AUDIT_BASE_URL || config.baseUrl).replace(/\/$/, '');
const outDir = resolve(here, arg('out', 'out'));
const quiet = process.argv.includes('--quiet');
const startedAt = new Date().toISOString();

mkdirSync(`${outDir}/screenshots`, { recursive: true });

const axeSource = readFileSync(resolve(here, 'node_modules/axe-core/axe.min.js'), 'utf8');
const findings = new FindingList();

console.log(`Auditing ${baseUrl} …`);

const httpSummary = await runHttpChecks({ baseUrl, config, findings });
const serviceWorker = await inspectServiceWorker({ baseUrl, findings });

const browser = await chromium.launch();
let pageResults = [];
let offlineResults = [];
try {
  pageResults = await auditRoutes({
    browser,
    baseUrl,
    config,
    findings,
    axeSource,
    screenshotDir: `${outDir}/screenshots`,
  });
  offlineResults = await runOfflineChecks({
    browser,
    baseUrl,
    config,
    findings,
    screenshotDir: `${outDir}/screenshots`,
  });
} finally {
  await browser.close();
}

const report = { baseUrl, startedAt, httpSummary, serviceWorker, findings: findings.sorted(), pageResults, offlineResults };
writeFileSync(`${outDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(`${outDir}/report.md`, `${toMarkdown({ baseUrl, startedAt, findings, pageResults, offlineResults })}\n`);

if (!quiet) printSummary({ baseUrl, findings });

const counts = findings.counts;
console.log(`Wrote ${outDir}/report.md and ${outDir}/report.json`);
console.log(`high=${counts.high} medium=${counts.medium} low=${counts.low}`);

process.exit(counts.high > 0 ? 1 : 0);
