#!/usr/bin/env node
/**
 * Concurrent buyer race against a staging (or explicitly allowed) event.
 *
 * Discovers the public event JSON, then fires N parallel create-order attempts
 * for the same entry time. Asserts that successes ≤ CAPACITY and that failures
 * are clean client errors (not 5xx), when the deployment exposes the expected
 * buyer APIs.
 *
 * Required env for --write:
 *   BASE_URL, EVENT_PATH (/venue/{venue}/{event})
 * Optional:
 *   TICKET_TYPE_ID, ENTRY_TIME_ID, CAPACITY, BUYER_EMAIL_DOMAIN
 *
 * Refuses production hosts unless --i-understand-this-hits-real-capacity is set.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import {
  fetchText,
  hostOf,
  mapPool,
  parseArgs,
  summarizeLatencies,
} from './lib/http.mjs'
import { fmtMs, saveArtifact, writeReport } from './lib/report.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'))
const args = parseArgs()

const baseUrl = (args.base || process.env.BASE_URL || config.baseUrl).replace(/\/$/, '')
const eventPath = args.event || process.env.EVENT_PATH || ''
const users = Number(args.users || 20)
const concurrency = Number(args.concurrency || users)
const timeoutMs = Number(args.timeout || config.defaultTimeoutMs)
const write = Boolean(args.write)
const forceProd = Boolean(args['i-understand-this-hits-real-capacity'])
const capacityHint = Number(args.capacity || process.env.CAPACITY || NaN)

const host = hostOf(baseUrl)
const isProd = config.productionHosts.includes(host)

if (!write) {
  console.log(`Dry run against ${baseUrl}${eventPath || ''}`)
  console.log('Pass --write (and staging BASE_URL + EVENT_PATH) to fire concurrent create-order attempts.')
  console.log('Discovery-only mode: fetch event page and list candidate order APIs.\n')
}

if (write && isProd && !forceProd) {
  console.error(
    `Refusing write race against production host ${host}.\n` +
      `Use a staging BASE_URL, or pass --i-understand-this-hits-real-capacity (not recommended).`,
  )
  process.exit(2)
}

if (write && !eventPath) {
  console.error('EVENT_PATH or --event=/venue/{venue}/{event} is required with --write')
  process.exit(2)
}

async function discoverEvent() {
  if (!eventPath) return { ok: false, reason: 'no EVENT_PATH' }
  const page = await fetchText(`${baseUrl}${eventPath}`, { timeoutMs })
  if (page.status === 404) {
    return { ok: false, reason: `event not found (${page.status})`, page }
  }

  // Prefer embedded Nuxt payload / JSON APIs commonly used by the buyer page.
  const candidates = [
    `${eventPath}.json`,
    `/api/public/events${eventPath.replace(/^\/venue/, '')}`,
    `/api/events${eventPath.replace(/^\/venue/, '')}`,
  ]

  const probes = []
  for (const c of candidates) {
    const url = c.startsWith('http') ? c : `${baseUrl}${c}`
    const res = await fetchText(url, { timeoutMs })
    probes.push({ url: c, status: res.status, ok: res.ok, sample: res.text.slice(0, 200) })
  }

  // Heuristic: find ticket type / entry time ids in SSR HTML if present.
  const typeId =
    process.env.TICKET_TYPE_ID ||
    page.text.match(/ticketTypeId["']?\s*[:=]\s*["']?([0-9a-f-]{8,})/i)?.[1] ||
    null
  const entryId =
    process.env.ENTRY_TIME_ID ||
    page.text.match(/entryTimeId["']?\s*[:=]\s*["']?([0-9a-f-]{8,})/i)?.[1] ||
    null

  return {
    ok: page.status === 200,
    status: page.status,
    typeId,
    entryId,
    probes,
    pageMs: page.ms,
  }
}

const discovery = await discoverEvent()
console.log('Discovery:', JSON.stringify({ ...discovery, page: undefined }, null, 2))

if (!write) {
  const report = {
    kind: 'race-buyers-dry-run',
    target: baseUrl,
    eventPath,
    discovery,
    checkedAt: new Date().toISOString(),
    ok: true,
    note: 'No write traffic sent. Re-run with --write on staging.',
  }
  const md = [
    `# Buyer race dry-run`,
    '',
    `Target: ${baseUrl}`,
    `Event: ${eventPath || '(none)'}`,
    '',
    'No create-order requests were sent.',
    '',
    '```json',
    JSON.stringify(discovery, null, 2),
    '```',
    '',
  ].join('\n')
  const { mdPath, jsonPath } = writeReport(join(__dirname, 'out'), 'race-buyers-dry', {
    markdown: md,
    json: report,
  })
  saveArtifact(mdPath, 'race-buyers-dry.md')
  saveArtifact(jsonPath, 'race-buyers-dry.json')
  console.log(`Wrote ${mdPath}`)
  process.exit(0)
}

const typeId = discovery.typeId || process.env.TICKET_TYPE_ID
const entryId = discovery.entryId || process.env.ENTRY_TIME_ID
if (!typeId || !entryId) {
  console.error(
    'Could not discover TICKET_TYPE_ID / ENTRY_TIME_ID from the event page.\n' +
      'Set them explicitly in the environment for this staging event.',
  )
  process.exit(2)
}

// Candidate create-order endpoints. The first that returns non-404 shapes the race.
const orderEndpoints = [
  '/api/orders',
  '/api/public/orders',
  '/api/buyer/orders',
]

async function pickEndpoint() {
  for (const ep of orderEndpoints) {
    const probe = await fetchText(`${baseUrl}${ep}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
      timeoutMs: 8000,
    })
    // 400/422 = route exists but body invalid; 401/403 = exists but auth; 404 = no route
    if (probe.status !== 404) return { ep, probeStatus: probe.status, probeBody: probe.text.slice(0, 300) }
  }
  return null
}

const endpoint = await pickEndpoint()
if (!endpoint) {
  console.error(
    'No create-order API responded (all 404). The buyer API shape may have changed,\n' +
      'or this deployment only accepts orders through a different path. Update orderEndpoints in race-buyers.mjs\n' +
      'using the staging app source (server/api/orders*).',
  )
  process.exit(2)
}
console.log(`Using ${endpoint.ep} (probe → ${endpoint.probeStatus})`)

const emailDomain = process.env.BUYER_EMAIL_DOMAIN || 'concurrency-test.invalid'
const jobs = Array.from({ length: users }, (_, i) => ({
  i,
  email: `buyer-${Date.now()}-${i}@${emailDomain}`,
}))

const wallStart = performance.now()
const results = await mapPool(jobs, concurrency, async ({ i, email }) => {
  const body = {
    email,
    ticketTypeId: typeId,
    entryTimeId: entryId,
    quantity: 1,
  }
  try {
    const res = await fetchText(`${baseUrl}${endpoint.ep}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      timeoutMs,
    })
    let json = null
    try {
      json = JSON.parse(res.text)
    } catch {
      /* ignore */
    }
    return {
      i,
      email,
      status: res.status,
      ms: res.ms,
      ok: res.status >= 200 && res.status < 300,
      body: res.text.slice(0, 500),
      json,
    }
  } catch (err) {
    return {
      i,
      email,
      status: 0,
      ms: timeoutMs,
      ok: false,
      body: '',
      error: String(err.message || err),
    }
  }
})
const wallMs = performance.now() - wallStart

const successes = results.filter((r) => r.ok)
const serverErrors = results.filter((r) => r.status >= 500)
const clientRejects = results.filter((r) => r.status >= 400 && r.status < 500)
const lat = summarizeLatencies(results.map((r) => r.ms))

const capacity = Number.isFinite(capacityHint) ? capacityHint : null
const oversold = capacity != null && successes.length > capacity
const has5xx = serverErrors.length > 0
const ok = !oversold && !has5xx

const report = {
  kind: 'race-buyers',
  target: baseUrl,
  eventPath,
  endpoint: endpoint.ep,
  users,
  concurrency,
  capacity,
  successes: successes.length,
  clientRejects: clientRejects.length,
  serverErrors: serverErrors.length,
  oversold,
  latency: lat,
  wallMs,
  results: results.map(({ i, email, status, ms, ok: o, error }) => ({
    i,
    email,
    status,
    ms,
    ok: o,
    error: error || null,
  })),
  checkedAt: new Date().toISOString(),
  ok,
}

const md = [
  `# Buyer race — ${users} concurrent create-order`,
  '',
  `Target: ${baseUrl}${eventPath}`,
  `Endpoint: \`POST ${endpoint.ep}\``,
  `Capacity hint: ${capacity ?? '(not set)'}`,
  `Successes: **${successes.length}**`,
  `Client rejects (4xx): ${clientRejects.length}`,
  `Server errors (5xx): ${serverErrors.length}`,
  `Oversold: ${oversold ? 'YES' : 'no'}`,
  `Wall: ${fmtMs(wallMs)} · p50 ${fmtMs(lat.p50)} · p95 ${fmtMs(lat.p95)}`,
  '',
  ok
    ? 'Race invariants held (no oversell vs capacity hint, no 5xx).'
    : 'Race invariants FAILED — investigate before any production on-sale.',
  '',
].join('\n')

const { mdPath, jsonPath } = writeReport(join(__dirname, 'out'), 'race-buyers', {
  markdown: md,
  json: report,
})
saveArtifact(mdPath, 'race-buyers.md')
saveArtifact(jsonPath, 'race-buyers.json')
console.log(md)
console.log(`Wrote ${mdPath}`)
process.exit(ok ? 0 : 1)
