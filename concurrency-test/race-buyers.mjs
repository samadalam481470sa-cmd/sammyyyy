#!/usr/bin/env node
/**
 * Concurrent buyer race against a TheNetTicket deployment.
 *
 * Real buyer API (from venue page bundle):
 *   GET  /api/public/events/{venueSlug}/{eventSlug}
 *   GET  /api/public/availability/{eventId}
 *   POST /api/orders  { eventId, timeslotId, items:[{ticketTypeId,quantity}], buyerEmail, buyerName? }
 *        header Idempotency-Key
 *   POST /api/orders/{orderId}/checkout
 *
 *   BASE_URL=https://dev.ticket.thenetvr.com \
 *   EVENT_PATH=/venue/{venue}/{event} \
 *   npm run race-buyers -- --users 100 --write [--checkout]
 *
 * Refuses production hosts unless --i-understand-this-hits-real-capacity is set.
 */
import { randomUUID } from 'node:crypto'
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
const eventPath = (args.event || process.env.EVENT_PATH || '').replace(/\/$/, '')
const users = Number(args.users || 20)
const concurrency = Number(args.concurrency || users)
const timeoutMs = Number(args.timeout || config.defaultTimeoutMs)
const write = Boolean(args.write)
const doCheckout = Boolean(args.checkout)
const forceProd = Boolean(args['i-understand-this-hits-real-capacity'])
const capacityHint = Number(args.capacity || process.env.CAPACITY || NaN)

const host = hostOf(baseUrl)
const isProd = config.productionHosts.includes(host)

function fail(msg, code = 2) {
  console.error(msg)
  process.exit(code)
}

if (!write) {
  console.log(`Dry run against ${baseUrl}${eventPath || ''}`)
  console.log('Pass --write with EVENT_PATH to fire concurrent create-order attempts.\n')
}

if (write && isProd && !forceProd) {
  fail(
    `Refusing write race against production host ${host}.\n` +
      `Use a staging/dev BASE_URL (e.g. https://dev.ticket.thenetvr.com), or pass --i-understand-this-hits-real-capacity.`,
  )
}

if (write && !eventPath) {
  fail('EVENT_PATH or --event=/venue/{venue}/{event} is required with --write')
}

async function discoverEvent() {
  if (!eventPath) return { ok: false, reason: 'no EVENT_PATH' }
  const m = eventPath.match(/^\/venue\/([^/]+)\/([^/]+)$/)
  if (!m) return { ok: false, reason: `EVENT_PATH must look like /venue/{venue}/{event}, got ${eventPath}` }
  const [, venueSlug, eventSlug] = m

  const ev = await fetchText(`${baseUrl}/api/public/events/${venueSlug}/${eventSlug}`, {
    timeoutMs,
    headers: { accept: 'application/json' },
  })
  if (!ev.ok) {
    return {
      ok: false,
      reason: `GET /api/public/events/${venueSlug}/${eventSlug} → ${ev.status}`,
      body: ev.text.slice(0, 400),
    }
  }

  let data
  try {
    data = JSON.parse(ev.text)
  } catch {
    return { ok: false, reason: 'event JSON parse failed', body: ev.text.slice(0, 400) }
  }

  const eventId = data.event?.id || data.id || process.env.EVENT_ID
  const ticketTypes = data.ticketTypes || data.event?.ticketTypes || []
  const ticketTypeId =
    process.env.TICKET_TYPE_ID ||
    ticketTypes.find((t) => (t.priceCents ?? t.price_cents ?? 1) === 0)?.id ||
    ticketTypes[0]?.id ||
    null

  let timeslotId = process.env.TIMESLOT_ID || process.env.ENTRY_TIME_ID || null
  let remaining = null
  let avail = null
  if (eventId) {
    const a = await fetchText(`${baseUrl}/api/public/availability/${eventId}`, {
      timeoutMs,
      headers: { accept: 'application/json' },
    })
    if (a.ok) {
      try {
        avail = JSON.parse(a.text)
      } catch {
        /* ignore */
      }
    }
  }

  const slots = avail?.timeslots || avail?.times || data.timeslots || []
  if (!timeslotId && slots.length) {
    const best =
      slots.find((s) => (s.remaining ?? s.capacity ?? 0) > 0) || slots[0]
    timeslotId = best.id || best.timeslotId
    remaining = best.remaining ?? best.capacity ?? null
  } else if (timeslotId && slots.length) {
    const hit = slots.find((s) => s.id === timeslotId || s.timeslotId === timeslotId)
    remaining = hit?.remaining ?? hit?.capacity ?? null
  }

  return {
    ok: Boolean(eventId && timeslotId && ticketTypeId),
    venueSlug,
    eventSlug,
    eventId,
    timeslotId,
    ticketTypeId,
    remaining,
    ticketTypes: ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: t.priceCents ?? t.price_cents,
    })),
    slots: slots.map((s) => ({
      id: s.id || s.timeslotId,
      remaining: s.remaining ?? null,
      capacity: s.capacity ?? null,
    })),
    rawKeys: Object.keys(data),
  }
}

const discovery = await discoverEvent()
console.log('Discovery:', JSON.stringify(discovery, null, 2))

if (!write) {
  const report = {
    kind: 'race-buyers-dry-run',
    target: baseUrl,
    eventPath,
    discovery,
    checkedAt: new Date().toISOString(),
    ok: true,
  }
  const md = [
    `# Buyer race dry-run`,
    '',
    `Target: ${baseUrl}`,
    `Event: ${eventPath || '(none)'}`,
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

if (!discovery.ok) {
  fail(`Could not discover event/timeslot/ticket type: ${discovery.reason || JSON.stringify(discovery)}`)
}

const { eventId, timeslotId, ticketTypeId } = discovery
const emailDomain = process.env.BUYER_EMAIL_DOMAIN || 'concurrency-test.invalid'
const capacity =
  Number.isFinite(capacityHint) ? capacityHint : discovery.remaining != null ? Number(discovery.remaining) : null

const jobs = Array.from({ length: users }, (_, i) => ({
  i,
  email: `buyer-${Date.now()}-${i}@${emailDomain}`,
}))

console.log(
  `Racing ${users} buyers (concurrency=${concurrency}) against event=${eventId} timeslot=${timeslotId} type=${ticketTypeId} capacity≈${capacity ?? '?'} checkout=${doCheckout}`,
)

const wallStart = performance.now()
const results = await mapPool(jobs, concurrency, async ({ i, email }) => {
  const body = {
    eventId,
    timeslotId,
    items: [{ ticketTypeId, quantity: 1 }],
    buyerEmail: email,
    buyerName: `Load Buyer ${i}`,
  }
  try {
    const res = await fetchText(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(body),
      timeoutMs,
    })
    let json = null
    try {
      json = JSON.parse(res.text)
    } catch {
      /* ignore */
    }
    const held = res.status >= 200 && res.status < 300 && Boolean(json?.orderId || json?.ok)
    let checkout = null
    if (held && doCheckout && json?.orderId) {
      const c = await fetchText(`${baseUrl}/api/orders/${json.orderId}/checkout`, {
        method: 'POST',
        headers: { accept: 'application/json' },
        timeoutMs,
      })
      let cj = null
      try {
        cj = JSON.parse(c.text)
      } catch {
        /* ignore */
      }
      checkout = {
        status: c.status,
        walletUrl: cj?.walletUrl || null,
        checkoutUrl: cj?.checkoutUrl || null,
        ok: Boolean(cj?.walletUrl || cj?.checkoutUrl),
      }
    }
    return {
      i,
      email,
      status: res.status,
      ms: res.ms,
      ok: held,
      orderId: json?.orderId || null,
      message: json?.message || json?.statusMessage || null,
      checkout,
      error: null,
    }
  } catch (err) {
    return {
      i,
      email,
      status: 0,
      ms: timeoutMs,
      ok: false,
      orderId: null,
      message: null,
      checkout: null,
      error: String(err.message || err),
    }
  }
})
const wallMs = performance.now() - wallStart

const successes = results.filter((r) => r.ok)
const serverErrors = results.filter((r) => r.status >= 500)
const clientRejects = results.filter((r) => r.status >= 400 && r.status < 500)
const lat = summarizeLatencies(results.map((r) => r.ms))
const oversold = capacity != null && successes.length > capacity
const underfill =
  capacity != null && users >= capacity && successes.length < capacity && serverErrors.length === 0
const checkoutOk = doCheckout ? successes.filter((r) => r.checkout?.ok).length : null
const has5xx = serverErrors.length > 0
const ok = !oversold && !has5xx

const report = {
  kind: 'race-buyers',
  target: baseUrl,
  eventPath,
  eventId,
  timeslotId,
  ticketTypeId,
  users,
  concurrency,
  capacity,
  doCheckout,
  successes: successes.length,
  checkoutOk,
  clientRejects: clientRejects.length,
  serverErrors: serverErrors.length,
  oversold,
  underfill,
  latency: lat,
  wallMs,
  sampleRejects: clientRejects.slice(0, 5).map((r) => ({
    status: r.status,
    message: r.message,
  })),
  results: results.map(({ i, email, status, ms, ok: o, orderId, message, checkout, error }) => ({
    i,
    email,
    status,
    ms,
    ok: o,
    orderId,
    message,
    checkout,
    error,
  })),
  checkedAt: new Date().toISOString(),
  ok,
}

const md = [
  `# Buyer race — ${users} concurrent create-order`,
  '',
  `Target: ${baseUrl}${eventPath}`,
  `eventId=\`${eventId}\` timeslotId=\`${timeslotId}\` ticketTypeId=\`${ticketTypeId}\``,
  `Capacity: ${capacity ?? '(unknown)'}`,
  `Successes (holds): **${successes.length}**`,
  doCheckout ? `Checkouts that returned wallet/checkout URL: **${checkoutOk}**` : 'Checkout step: skipped (pass --checkout)',
  `Client rejects (4xx): ${clientRejects.length}`,
  `Server errors (5xx): ${serverErrors.length}`,
  `Oversold: ${oversold ? 'YES' : 'no'}`,
  `Underfill (got fewer holds than capacity with no 5xx): ${underfill ? 'yes' : 'no'}`,
  `Wall: ${fmtMs(wallMs)} · p50 ${fmtMs(lat.p50)} · p95 ${fmtMs(lat.p95)}`,
  '',
  ok
    ? 'Race invariants held (no oversell vs capacity, no 5xx).'
    : 'Race invariants FAILED.',
  '',
].join('\n')

const name = `race-buyers-${users}u`
const { mdPath, jsonPath } = writeReport(join(__dirname, 'out'), name, {
  markdown: md,
  json: report,
})
saveArtifact(mdPath, `${name}.md`)
saveArtifact(jsonPath, `${name}.json`)
console.log(md)
console.log(`Wrote ${mdPath}`)
process.exit(ok ? 0 : 1)
