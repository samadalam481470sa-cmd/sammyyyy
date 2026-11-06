/**
 * Attack defense for the Newport API.
 *
 * Every suspicious act adds points to the sender's address. Reaching the limit blocks that address,
 * and repeat offenders are blocked for longer. Blocks are stored in the database, so a restart does
 * not lift them. A person with a valid session is never blocked, so one attacker on a shared office
 * network cannot lock out the whole office.
 *
 * SQL injection is stopped where it matters: every query binds its values as parameters, and table
 * and column names come only from fixed lists in the code. The URL patterns here only detect and
 * block people probing for it. Request bodies are never pattern-matched, because a note that says
 * "drop table" or "select one" is ordinary text and is stored as text.
 */
import type { NextFunction, Request, Response } from 'express'
import { ipKeyGenerator } from 'express-rate-limit'
import { db, hashToken } from '../db/index.ts'

const STRIKE_LIMIT = 100
const STRIKE_WINDOW_MS = 15 * 60 * 1000
/** First block, second, third and later. A clean week starts over. */
const BLOCK_STEPS_MS = [30 * 60 * 1000, 2 * 3600 * 1000, 24 * 3600 * 1000]
const LEVEL_MEMORY_MS = 7 * 24 * 3600 * 1000
const EVENT_KEEP_DAYS = 30
const EVENT_CAP = 5000

export type DefenseEvent =
  | 'auth_failure'
  | 'invalid_session'
  | 'blocked_request'
  | 'block_started'
  | 'block_lifted'
  | 'scanner_probe'
  | 'sql_injection_probe'
  | 'path_traversal_probe'
  | 'xss_probe'
  | 'rate_limit'
  | 'flood'
  | 'unsafe_json'
  | 'bad_upload'
  | 'denied_origin'
  | 'denied_record_write'

/** Points for each event. Five failed sign-ins, or four scanner probes, reach the limit. */
export const STRIKES = { authFailure: 20, invalidSession: 1, probe: 25, rateLimit: 10, flood: 20, unsafeJson: 25, badUpload: 10, deniedOrigin: 5, badJson: 2 } as const

db.exec(`
  CREATE TABLE IF NOT EXISTS security_blocks (
    ip TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    blocked_until INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ip TEXT,
    path TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
`)

interface Score {
  auth: number
  other: number
  firstAt: number
}

const scores = new Map<string, Score>()
const blocks = new Map<string, { until: number; level: number; reason: string }>()
const lastEventAt = new Map<string, number>()

for (const row of db.prepare(`SELECT ip, reason, level, blocked_until FROM security_blocks`).all() as { ip: string; reason: string; level: number; blocked_until: number }[]) {
  blocks.set(row.ip, { until: row.blocked_until, level: row.level, reason: row.reason })
}

function trustedIps(): Set<string> {
  return new Set((process.env.DEFENSE_TRUSTED_IPS ?? '').split(',').map((v) => v.trim()).filter(Boolean))
}

/**
 * Azure's proxy can report the client as "1.2.3.4:51122". A new port on every connection would make
 * each attempt look like a new person, so the port is removed before anything counts attempts.
 */
export function cleanIp(raw: string | undefined): string {
  let ip = (raw ?? '').trim()
  if (!ip) return ''
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip)
  if (bracketed) return bracketed[1]
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) return ip.split(':')[0]
  return ip
}

/** The address strikes count against. IPv6 counts by network, since one person controls many addresses. */
export function blockKey(ip: string | undefined): string {
  const clean = cleanIp(ip)
  if (!clean) return 'unknown'
  try {
    return ipKeyGenerator(clean)
  } catch {
    return clean
  }
}

export function normalizeClientIp(req: Request, _res: Response, next: NextFunction) {
  Object.defineProperty(req, 'ip', { value: cleanIp(req.ip), configurable: true })
  next()
}

/** One row per type, address and minute, so an attack cannot fill the database with its own log. */
export function logDefenseEvent(type: DefenseEvent, req: Request | null, detail = '') {
  const ip = req ? blockKey(req.ip) : null
  const key = `${type}|${ip}`
  const now = Date.now()
  if (now - (lastEventAt.get(key) ?? 0) < 60_000) return
  lastEventAt.set(key, now)
  db.prepare(`INSERT INTO security_events (type, ip, path, detail) VALUES (?, ?, ?, ?)`).run(type, ip, req ? req.path.slice(0, 200) : null, detail.slice(0, 300))
}

function startBlock(key: string, reason: string, req: Request | null) {
  const previous = blocks.get(key)
  const level = previous && Date.now() - previous.until < LEVEL_MEMORY_MS ? Math.min(previous.level + 1, BLOCK_STEPS_MS.length) : 1
  const until = Date.now() + BLOCK_STEPS_MS[level - 1]
  blocks.set(key, { until, level, reason })
  db.prepare(
    `INSERT INTO security_blocks (ip, reason, level, blocked_until) VALUES (?, ?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, level = excluded.level, blocked_until = excluded.blocked_until, created_at = datetime('now')`,
  ).run(key, reason, level, until)
  scores.delete(key)
  lastEventAt.delete(`block_started|${key}`)
  logDefenseEvent('block_started', req, `Blocked for ${Math.round(BLOCK_STEPS_MS[level - 1] / 60000)} minutes: ${reason}`)
}

/** Adds points. Returns true when this addition started a block. */
export function addStrikes(req: Request, points: number, reason: string, kind: 'auth' | 'other' = 'other'): boolean {
  const key = blockKey(req.ip)
  if (trustedIps().has(cleanIp(req.ip)) || isBlockedKey(key)) return false
  const now = Date.now()
  let score = scores.get(key)
  if (!score || now - score.firstAt > STRIKE_WINDOW_MS) {
    score = { auth: 0, other: 0, firstAt: now }
    scores.set(key, score)
  }
  score[kind] += points
  if (score.auth + score.other < STRIKE_LIMIT) return false
  startBlock(key, reason, req)
  return true
}

/** A successful sign-in forgives failed sign-ins only, never probes. */
export function forgiveAuthFailures(ip: string | undefined) {
  const score = scores.get(blockKey(ip))
  if (score) score.auth = 0
}

function isBlockedKey(key: string): boolean {
  const block = blocks.get(key)
  return Boolean(block && block.until > Date.now())
}

export function isBlocked(ip: string | undefined): boolean {
  return isBlockedKey(blockKey(ip))
}

function hasValidSession(req: Request): boolean {
  const auth = req.get('authorization') ?? ''
  if (!auth.startsWith('Bearer nwp_sess_')) return false
  const row = db.prepare(`SELECT expires_at FROM sessions WHERE token_hash = ?`).get(hashToken(auth.slice(7).trim())) as { expires_at: string } | undefined
  return Boolean(row && new Date(row.expires_at).getTime() > Date.now())
}

export function blockGuard(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/health' || !isBlocked(req.ip) || hasValidSession(req)) return next()
  logDefenseEvent('blocked_request', req)
  const until = blocks.get(blockKey(req.ip))?.until ?? Date.now()
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((until - Date.now()) / 1000))))
  return res.status(429).json({ error: 'Too many failed or suspicious requests. This address is temporarily blocked.' })
}

const SCANNER_PATH = /(^|\/)(\.env|\.git|\.aws|\.ssh|\.htaccess|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|cgi-bin|actuator|boaform|server-status|vendor\/phpunit)(\/|\.|$)|\.(php|asp|aspx|jsp|cgi|bak|sql)$/i
const TRAVERSAL = /\.\.[\\/]|\0/
const SQL_PROBE = /\bunion\b\s+(all\s+)?select\b|\bor\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+|'\s*(or|and)\s+|'\s*--|;\s*(drop|delete|update|insert|alter|truncate|attach|pragma)\b|\bsqlite_master\b|\bload_extension\s*\(|\bsleep\s*\(\s*\d|\bbenchmark\s*\(/i
const XSS_PROBE = /<\s*script\b|javascript:|\bon(error|load)\s*=/i

function decoded(url: string): string {
  let out = url
  // Twice, because attackers encode twice to slip past a single decode.
  for (let i = 0; i < 2; i += 1) {
    try {
      out = decodeURIComponent(out)
    } catch {
      break
    }
  }
  return out.replace(/\+/g, ' ')
}

/** Classifies a request URL as an attack probe. Exported so it can be tested on its own. */
export function classifyUrl(originalUrl: string): { type: DefenseEvent; status: number } | null {
  const url = decoded(originalUrl)
  const path = url.split('?')[0]
  if (TRAVERSAL.test(url) || /%2e%2e/i.test(originalUrl)) return { type: 'path_traversal_probe', status: 400 }
  if (SCANNER_PATH.test(path)) return { type: 'scanner_probe', status: 404 }
  if (SQL_PROBE.test(url)) return { type: 'sql_injection_probe', status: 400 }
  if (XSS_PROBE.test(url)) return { type: 'xss_probe', status: 400 }
  return null
}

export function probeGuard(req: Request, res: Response, next: NextFunction) {
  const probe = classifyUrl(req.originalUrl)
  if (!probe) return next()
  logDefenseEvent(probe.type, req, req.originalUrl.slice(0, 200))
  addStrikes(req, STRIKES.probe, probe.type)
  return res.status(probe.status).json({ error: probe.status === 404 ? 'Not found' : 'Bad request' })
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_JSON_DEPTH = 40
const MAX_JSON_NODES = 300_000

/** Finds what could poison objects or exhaust the server while it reads a body. */
export function jsonProblem(body: unknown): string | null {
  const stack: { value: unknown; depth: number }[] = [{ value: body, depth: 0 }]
  let nodes = 0
  while (stack.length) {
    const { value, depth } = stack.pop()!
    if (value === null || typeof value !== 'object') continue
    if (depth > MAX_JSON_DEPTH) return 'nested too deeply'
    nodes += 1
    if (nodes > MAX_JSON_NODES) return 'too many values'
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) return `forbidden key ${key}`
      stack.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 })
    }
  }
  return null
}

export function jsonSafetyGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Buffer.isBuffer(req.body) || typeof req.body !== 'object') return next()
  const problem = jsonProblem(req.body)
  if (!problem) return next()
  logDefenseEvent('unsafe_json', req, problem)
  addStrikes(req, STRIKES.unsafeJson, 'unsafe_json')
  return res.status(400).json({ error: 'Invalid request body.' })
}

const BLOCKED_EXTENSIONS = /\.(exe|msi|bat|cmd|com|scr|pif|ps1|vbs|vbe|js|mjs|jse|wsf|wsh|hta|jar|dll|sh|php|html?|xhtml|svg|lnk|reg|cpl|apk)$/i

/** Executable and page files are refused, by name and by their first bytes. Returns the reason. */
export function uploadProblem(name: string, data: Buffer): string | null {
  if (BLOCKED_EXTENSIONS.test(name.trim().replace(/[.\s]+$/, ''))) return 'This file type cannot be stored in the CRM.'
  const first = data.subarray(0, 4)
  const windowsProgram = first[0] === 0x4d && first[1] === 0x5a
  const linuxProgram = first.toString('latin1') === '\x7fELF'
  const script = first.subarray(0, 2).toString('latin1') === '#!'
  return windowsProgram || linuxProgram || script ? 'This file looks like a program and cannot be stored in the CRM.' : null
}

export function defenseStatus() {
  const now = Date.now()
  const active = [...blocks.entries()].filter(([, b]) => b.until > now).map(([ip, b]) => ({ ip, reason: b.reason, level: b.level, blockedUntil: new Date(b.until).toISOString() }))
  const last24h = db.prepare(`SELECT type, COUNT(*) AS count FROM security_events WHERE datetime(created_at) > datetime('now', '-1 day') GROUP BY type ORDER BY count DESC`).all() as { type: string; count: number }[]
  const events = db.prepare(`SELECT id, type, ip, path, detail, created_at AS createdAt FROM security_events ORDER BY id DESC LIMIT 50`).all()
  return { activeBlocks: active, last24h, events }
}

export function liftBlock(key: string, req: Request): boolean {
  const block = blocks.get(key)
  if (!block || block.until <= Date.now()) return false
  // The level is kept, so an address that offends again is blocked for longer.
  block.until = Date.now() - 1
  db.prepare(`UPDATE security_blocks SET blocked_until = ? WHERE ip = ?`).run(block.until, key)
  scores.delete(key)
  logDefenseEvent('block_lifted', req, key)
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [key, score] of scores) if (now - score.firstAt > STRIKE_WINDOW_MS) scores.delete(key)
  for (const [key, at] of lastEventAt) if (now - at > 60_000) lastEventAt.delete(key)
  for (const [key, block] of blocks) {
    if (now - block.until > LEVEL_MEMORY_MS) {
      blocks.delete(key)
      db.prepare(`DELETE FROM security_blocks WHERE ip = ?`).run(key)
    }
  }
  db.prepare(`DELETE FROM security_events WHERE datetime(created_at) < datetime('now', ?)`).run(`-${EVENT_KEEP_DAYS} days`)
  db.prepare(`DELETE FROM security_events WHERE id <= (SELECT MAX(id) FROM security_events) - ?`).run(EVENT_CAP)
}, 10 * 60 * 1000).unref()
