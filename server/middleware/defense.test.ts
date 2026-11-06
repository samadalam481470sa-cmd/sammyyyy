// @vitest-environment node
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newport-defense-'))
process.env.CRM_DB_PATH = path.join(dir, 'test.db')
process.env.ALLOWED_EMAILS = 'approved@newport.test'
process.env.ADMIN_EMAILS = 'admin@newport.test'

type Db = typeof import('../db/index.ts')
let db: Db['db']
let hashToken: Db['hashToken']
let defense: typeof import('./defense.ts')
let server: Server
let base = ''
let counter = 10

/** A new address per test, sent the way Azure's proxy sends it. */
const nextIp = () => `203.0.113.${(counter += 1)}`
const call = (route: string, ip: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('x-forwarded-for', `${ip}:${40000 + counter * 7 + Math.floor(Math.random() * 1000)}`)
  return fetch(`${base}${route}`, { ...init, headers })
}
const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) })

function makeSession(role: 'partner' | 'admin', subject: string | null, name = 'Sam Tester') {
  const id = `user-${Math.random().toString(36).slice(2)}`
  db.prepare(`INSERT INTO users (id, email, name, role, initials, password_hash) VALUES (?, ?, ?, ?, 'ST', NULL)`).run(id, `${id}@newport.test`, name, role)
  const token = `nwp_sess_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, auth_method, expires_at, auth_subject) VALUES (?, ?, ?, 'microsoft', ?, ?)`).run(`s-${id}`, id, hashToken(token), new Date(Date.now() + 3600_000).toISOString(), subject)
  return { authorization: `Bearer ${token}` }
}

const counts = () => (['opportunities', 'users', 'sessions', 'workspace_records'] as const).map((t) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c)

beforeAll(async () => {
  const dbModule = await import('../db/index.ts')
  db = dbModule.db
  hashToken = dbModule.hashToken
  defense = await import('./defense.ts')
  const { createApp } = await import('../app.ts')
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve())
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('SQL injection', () => {
  const payloads = ["'; DROP TABLE opportunities; --", "' OR '1'='1", "x' UNION SELECT token_hash FROM sessions --", "1; ATTACH DATABASE '/tmp/x' AS y"]

  it('stores attack text in a request body as plain text and changes no table', async () => {
    const auth = makeSession('partner', 'acct-sql')
    const ip = nextIp()
    for (const [i, text] of payloads.entries()) {
      const res = await call('/api/workspace/changes', ip, json({ changes: [{ collection: 'contacts', id: `sql-${i}`, data: { name: text, notes: text } }] }, auth))
      expect(res.status).toBe(200)
    }
    const row = db.prepare(`SELECT data FROM workspace_records WHERE collection = 'contacts' AND id = 'sql-0'`).get() as { data: string }
    expect(JSON.parse(row.data).name).toBe(payloads[0])
    expect((db.prepare(`SELECT COUNT(*) AS c FROM opportunities`).get() as { c: number }).c).toBeGreaterThan(0)
    expect(defense.isBlocked(ip)).toBe(false)
  })

  it('ordinary business words in a body are never treated as an attack', async () => {
    const auth = makeSession('partner', 'acct-words')
    const ip = nextIp()
    const res = await call('/api/workspace/changes', ip, json({ changes: [{ collection: 'contacts', id: 'o-brien', data: { name: "O'Brien or 1=1 Insurance", notes: 'Please select one and drop the table of contents; update later' } }] }, auth))
    expect(res.status).toBe(200)
  })

  it('refuses probes in the URL and leaves the database unchanged', async () => {
    const before = counts()
    for (const route of [`/api/opportunities/${encodeURIComponent("' OR 1=1 --")}`, `/api/workspace?since=${encodeURIComponent("x' UNION SELECT * FROM users --")}`, `/api/resources/contacts?x=${encodeURIComponent('1; DROP TABLE users')}`]) {
      const res = await call(route, nextIp())
      expect(res.status).toBe(400)
    }
    expect(counts()).toEqual(before)
  })

  it('an invented resource or column cannot reach the SQL text', async () => {
    const auth = makeSession('partner', 'acct-col')
    const ip = nextIp()
    expect((await call('/api/resources/users', ip, { headers: auth })).status).toBe(404)
    const res = await call('/api/resources/contacts', ip, json({ 'name) VALUES (1); DROP TABLE users; --': 'x' }, auth))
    expect(res.status).toBe(400)
    expect((db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }).c).toBeGreaterThan(0)
  })
})

describe('brute force', () => {
  const attempt = (ip: string) => call('/api/auth/api-key', ip, json({ apiKey: `guess-${Math.random().toString(36)}-0123456789abcdef` }))

  it('blocks an address after five failures, even with a new port each time', async () => {
    const ip = nextIp()
    for (let i = 0; i < 5; i += 1) expect((await attempt(ip)).status).toBe(401)
    const blocked = await attempt(ip)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
    expect(defense.isBlocked(ip)).toBe(true)
  })

  it('stores the block, so a restart does not lift it', () => {
    const row = db.prepare(`SELECT level, blocked_until FROM security_blocks ORDER BY rowid DESC LIMIT 1`).get() as { level: number; blocked_until: number }
    expect(row.level).toBeGreaterThanOrEqual(1)
    expect(row.blocked_until).toBeGreaterThan(Date.now())
  })

  it('a valid signed-in person on a blocked network keeps working', async () => {
    const ip = nextIp()
    for (let i = 0; i < 5; i += 1) await attempt(ip)
    expect(defense.isBlocked(ip)).toBe(true)
    const auth = makeSession('partner', 'acct-office')
    expect((await call('/api/workspace', ip, { headers: auth })).status).toBe(200)
    expect((await call('/api/workspace', ip, { headers: { authorization: 'Bearer nwp_sess_madeup' } })).status).toBe(429)
  })

  it('made-up session tokens add up to a block, so rotating them does not help', async () => {
    const ip = nextIp()
    let last = 0
    for (let i = 0; i < 105; i += 1) last = (await call('/api/workspace', ip, { headers: { authorization: `Bearer nwp_sess_guess${i}` } })).status
    expect(last).toBe(429)
    expect(defense.isBlocked(ip)).toBe(true)
  })

  it('a lifted block can be set again, and for longer', async () => {
    const ip = nextIp()
    for (let i = 0; i < 5; i += 1) await attempt(ip)
    const admin = makeSession('admin', 'acct-admin')
    const adminIp = nextIp()
    expect((await call(`/api/security/defense/blocks/${encodeURIComponent(ip)}`, adminIp, { method: 'DELETE', headers: admin })).status).toBe(200)
    expect(defense.isBlocked(ip)).toBe(false)
    for (let i = 0; i < 5; i += 1) await attempt(ip)
    const row = db.prepare(`SELECT level FROM security_blocks WHERE ip = ?`).get(ip) as { level: number }
    expect(row.level).toBe(2)
  })
})

describe('probes and bad input', () => {
  it('scanners and traversal get no information and four probes block them', async () => {
    const ip = nextIp()
    expect((await call('/.env', ip)).status).toBe(404)
    expect((await call('/wp-login.php', ip)).status).toBe(404)
    expect((await call('/api/x?file=..%2f..%2fetc%2fpasswd', ip)).status).toBe(400)
    expect((await call(`/api/opportunities?q=${encodeURIComponent('<script>alert(1)</script>')}`, ip)).status).toBe(400)
    expect(defense.isBlocked(ip)).toBe(true)
    expect((await call('/api/health', ip)).status).toBe(200)
  })

  it('classifies known attacks and leaves normal app URLs alone', () => {
    for (const ok of ['/api/workspace?since=2026-11-05T16:00:00.000Z', '/api/workspace/files/doc_1.pdf', '/api/resources/contacts/con_123', '/api/security/audit-logs?limit=50']) {
      expect(defense.classifyUrl(ok)).toBeNull()
    }
    expect(defense.classifyUrl('/a?id=1%2520OR%25201%253D1')?.type).toBe('sql_injection_probe')
  })

  it('refuses prototype pollution and absurd nesting', async () => {
    const auth = makeSession('partner', 'acct-json')
    const body = `{"changes":[{"collection":"contacts","id":"p","data":{"__proto__":{"isAdmin":true}}}]}`
    const res = await call('/api/workspace/changes', nextIp(), { method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body })
    expect(res.status).toBe(400)
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined()
    let deep: unknown = 1
    for (let i = 0; i < 60; i += 1) deep = { a: deep }
    expect(defense.jsonProblem(deep)).toBe('nested too deeply')
  })

  it('answers bad and oversized bodies without leaking details', async () => {
    const ip = nextIp()
    const bad = await call('/api/auth/api-key', ip, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' })
    expect(bad.status).toBe(400)
    expect(await bad.text()).not.toMatch(/SyntaxError|node_modules|at /)
    const big = await call('/api/auth/api-key', ip, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: 'x'.repeat(5 * 1024 * 1024) }) })
    expect(big.status).toBe(413)
  })

  it('refuses websites that are not approved', async () => {
    const res = await call('/api/health', nextIp(), { headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
    const ok = await call('/api/health', nextIp(), { headers: { origin: 'https://samadalam481470sa-cmd.github.io' } })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('health says nothing about the internals', async () => {
    const body = (await (await call('/api/health', nextIp())).json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['ok', 'service'])
  })

  it('sends protective headers and hides the framework', async () => {
    const res = await call('/api/health', nextIp())
    expect(res.headers.get('x-powered-by')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('strict-transport-security')).toBeTruthy()
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
  })
})

describe('uploads', () => {
  const put = (name: string, data: BodyInit, auth: Record<string, string>, ip: string) => call('/api/workspace/files/doc-up', ip, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'x-file-name': name, ...auth }, body: data })

  it('refuses programs and pages, by name and by content', async () => {
    const auth = makeSession('partner', 'acct-up')
    expect((await put('invoice.pdf.exe', 'data', auth, nextIp())).status).toBe(415)
    expect((await put('page.html', 'data', auth, nextIp())).status).toBe(415)
    expect((await put('trailing.exe. ', 'data', auth, nextIp())).status).toBe(415)
    expect((await put('report.pdf', Buffer.from([0x4d, 0x5a, 0, 0]), auth, nextIp())).status).toBe(415)
  })

  it('accepts a normal document, and a malformed name cannot crash the server', async () => {
    const auth = makeSession('partner', 'acct-up2')
    expect((await put('Closing%20Memo.pdf', '%PDF-1.7', auth, nextIp())).status).toBe(200)
    expect((await put('%E0%A4%A.pdf', '%PDF-1.7', auth, nextIp())).status).toBe(200)
    const down = await call('/api/workspace/files/doc-up', nextIp(), { headers: auth })
    expect(down.headers.get('content-disposition')).toContain('attachment')
  })
})

describe('access control', () => {
  it('everything requires sign-in', async () => {
    for (const route of ['/api/workspace', '/api/opportunities', '/api/security/defense', '/api/export/opportunities.csv', '/api/workspace/files/x']) {
      expect((await call(route, nextIp())).status).toBe(401)
    }
  })

  it('the attack log is for administrators only', async () => {
    expect((await call('/api/security/defense', nextIp(), { headers: makeSession('partner', 'a1') })).status).toBe(403)
    const res = await call('/api/security/defense', nextIp(), { headers: makeSession('admin', 'a2') })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { events: unknown[]; posture: { administrators: number } }
    expect(body.events.length).toBeGreaterThan(0)
    expect(body.posture.administrators).toBe(1)
  })
})

describe('CSV exports', () => {
  it('a text cell cannot run as a formula', async () => {
    const auth = makeSession('admin', 'acct-csv')
    db.prepare(`UPDATE opportunities SET project_name = ? WHERE project_number = (SELECT MIN(project_number) FROM opportunities)`).run('=HYPERLINK("http://evil.example")')
    const csv = await (await call('/api/export/opportunities.csv', nextIp(), { headers: auth })).text()
    expect(csv).toContain(`"'=HYPERLINK`)
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
  })
})

describe('address handling', () => {
  it('removes the port and the IPv4 prefix, and groups IPv6 by network', () => {
    expect(defense.cleanIp('203.0.113.9:51122')).toBe('203.0.113.9')
    expect(defense.cleanIp('::ffff:203.0.113.9')).toBe('203.0.113.9')
    expect(defense.cleanIp('[2001:db8::1]:443')).toBe('2001:db8::1')
    expect(defense.blockKey('2001:db8:1:1::5')).toBe(defense.blockKey('2001:db8:1:1::9'))
    expect(defense.blockKey('203.0.113.9:1')).toBe(defense.blockKey('203.0.113.9:2'))
  })
})
