import { Router } from 'express'
import { z } from 'zod'
import { db, createSessionToken, hashToken } from '../db/index.ts'
import { authRateLimit, writeAudit } from '../middleware/security.ts'

export const authRouter = Router()

authRouter.post('/demo', authRateLimit, (req, res) => {
  const user = db
    .prepare(`SELECT id, email, name, role, initials FROM users WHERE id = 'user-dennis'`)
    .get() as { id: string; email: string; name: string; role: string; initials: string }

  const token = createSessionToken()
  const sessionId = `sess_${Date.now()}`
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, auth_method, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, 'demo', ?, ?, ?)`,
  ).run(sessionId, user.id, hashToken(token), expiresAt, req.ip ?? null, req.get('user-agent') ?? null)

  writeAudit(user.id, user.name, 'auth.demo_signin', 'session', sessionId, 'Demo sign-in granted', req)

  res.json({
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      initials: user.initials,
    },
    notice:
      'Demo authentication only. Production access will require one of five provisioned API keys.',
  })
})

const apiKeySchema = z.object({
  apiKey: z.string().min(16).max(200),
})

authRouter.post('/api-key', authRateLimit, (req, res) => {
  const parsed = apiKeySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid API key payload' })
  }

  const key = db
    .prepare(
      `SELECT id, slot, label, status FROM api_keys WHERE key_hash = ? AND status = 'active'`,
    )
    .get(hashToken(parsed.data.apiKey)) as
    | { id: string; slot: number; label: string; status: string }
    | undefined

  if (!key) {
    writeAudit(null, 'anonymous', 'auth.api_key_failed', 'api_key', null, 'Rejected API key', req)
    return res.status(401).json({ error: 'Invalid or inactive API key' })
  }

  const user = db
    .prepare(`SELECT id, email, name, role, initials FROM users WHERE id = 'user-dennis'`)
    .get() as { id: string; email: string; name: string; role: string; initials: string }

  const token = createSessionToken()
  const sessionId = `sess_${Date.now()}`
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, auth_method, api_key_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, 'api_key', ?, ?, ?, ?)`,
  ).run(
    sessionId,
    user.id,
    hashToken(token),
    key.id,
    expiresAt,
    req.ip ?? null,
    req.get('user-agent') ?? null,
  )

  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(key.id)
  writeAudit(user.id, user.name, 'auth.api_key_signin', 'api_key', key.id, `Slot ${key.slot}`, req)

  res.json({
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      initials: user.initials,
    },
    apiKeySlot: key.slot,
    apiKeyLabel: key.label,
  })
})

authRouter.post('/signout', (req, res) => {
  const auth = req.header('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  }
  res.json({ ok: true })
})
