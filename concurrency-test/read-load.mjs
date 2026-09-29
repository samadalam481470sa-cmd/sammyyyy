#!/usr/bin/env node
/**
 * Concurrent read load: N virtual users hitting public pages.
 * Safe for production when limited to readPaths (no holds, no Stripe).
 *
 *   node read-load.mjs --users 10
 *   node read-load.mjs --users 100 --concurrency 50
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import {
  fetchText,
  mapPool,
  parseArgs,
  summarizeLatencies,
} from './lib/http.mjs'
import { fmtMs, saveArtifact, writeReport } from './lib/report.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'))
const args = parseArgs()

const baseUrl = (args.base || process.env.BASE_URL || config.baseUrl).replace(/\/$/, '')
const users = Number(args.users || config.defaultUsers)
const concurrency = Number(args.concurrency || users)
const timeoutMs = Number(args.timeout || config.defaultTimeoutMs)
const paths = config.readPaths

if (!Number.isFinite(users) || users < 1 || users > 500) {
  console.error('--users must be 1–500 (recommended 10–100)')
  process.exit(2)
}

console.log(
  `Read load: ${users} users, concurrency=${concurrency}, ${paths.length} paths → ${baseUrl}`,
)

const jobs = []
for (let u = 0; u < users; u++) {
  for (const path of paths) {
    jobs.push({ user: u, path })
  }
}

const wallStart = performance.now()
const results = await mapPool(jobs, concurrency, async ({ user, path }) => {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`
  try {
    const res = await fetchText(url, { timeoutMs })
    return {
      user,
      path,
      status: res.status,
      ok: res.ok || (path === '/api/health' && res.status === 200),
      ms: res.ms,
      error: null,
    }
  } catch (err) {
    return {
      user,
      path,
      status: 0,
      ok: false,
      ms: timeoutMs,
      error: err.name === 'AbortError' ? 'timeout' : String(err.message || err),
    }
  }
})
const wallMs = performance.now() - wallStart

const byPath = {}
for (const r of results) {
  byPath[r.path] ??= { ok: 0, fail: 0, statuses: {}, latencies: [], errors: [] }
  const b = byPath[r.path]
  if (r.ok) b.ok++
  else b.fail++
  b.statuses[r.status] = (b.statuses[r.status] || 0) + 1
  b.latencies.push(r.ms)
  if (r.error) b.errors.push(r.error)
}

const allLat = results.map((r) => r.ms)
const summary = summarizeLatencies(allLat)
const totalFail = results.filter((r) => !r.ok).length
const ok = totalFail === 0

const pathRows = Object.entries(byPath).map(([path, b]) => {
  const lat = summarizeLatencies(b.latencies)
  return {
    path,
    ok: b.ok,
    fail: b.fail,
    statuses: b.statuses,
    latency: lat,
    sampleErrors: [...new Set(b.errors)].slice(0, 5),
  }
})

const report = {
  kind: 'read-load',
  target: baseUrl,
  users,
  concurrency,
  paths,
  requests: results.length,
  failures: totalFail,
  wallMs,
  latency: summary,
  byPath: pathRows,
  checkedAt: new Date().toISOString(),
  ok,
}

const md = [
  `# Read load — ${users} concurrent users`,
  '',
  `Target: ${baseUrl}`,
  `Checked: ${report.checkedAt}`,
  `Requests: ${results.length} (${users} users × ${paths.length} paths), concurrency ${concurrency}`,
  `Wall time: ${fmtMs(wallMs)}`,
  `Failures: **${totalFail}**`,
  '',
  `## Latency (all requests)`,
  '',
  `| metric | value |`,
  `| --- | --- |`,
  `| min | ${fmtMs(summary.min)} |`,
  `| p50 | ${fmtMs(summary.p50)} |`,
  `| p95 | ${fmtMs(summary.p95)} |`,
  `| p99 | ${fmtMs(summary.p99)} |`,
  `| max | ${fmtMs(summary.max)} |`,
  `| mean | ${fmtMs(summary.mean)} |`,
  '',
  `## Per path`,
  '',
  `| path | ok | fail | p50 | p95 | statuses |`,
  `| --- | ---: | ---: | ---: | ---: | --- |`,
  ...pathRows.map(
    (r) =>
      `| \`${r.path}\` | ${r.ok} | ${r.fail} | ${fmtMs(r.latency.p50)} | ${fmtMs(r.latency.p95)} | ${JSON.stringify(r.statuses)} |`,
  ),
  '',
  ok
    ? 'All read requests succeeded.'
    : 'Some requests failed — inspect `read-load.json` for errors.',
  '',
].join('\n')

const name = `read-load-${users}u`
const { mdPath, jsonPath } = writeReport(join(__dirname, 'out'), name, {
  markdown: md,
  json: report,
})
saveArtifact(mdPath, `${name}.md`)
saveArtifact(jsonPath, `${name}.json`)
console.log(md)
console.log(`Wrote ${mdPath}`)
process.exit(ok ? 0 : 1)
