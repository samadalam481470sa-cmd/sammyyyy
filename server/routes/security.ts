import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db, hashToken } from '../db/index.ts'
import {
  requireAuth,
  requireRole,
  requireManager,
  writeAudit,
} from '../middleware/security.ts'

export const securityRouter = Router()

securityRouter.use(requireAuth)

/** Returns the five API key slots — never returns key hashes or secrets. */
securityRouter.get('/api-keys', requireRole('admin', 'partner'), (_req, res) => {
  const keys = db
    .prepare(
      `SELECT id, slot, label, key_prefix, status, last_used_at, expires_at, created_at
       FROM api_keys ORDER BY slot ASC`,
    )
    .all()
  res.json({
    slots: keys,
    capacity: 5,
    note: 'API keys are provisioned by the security team. This CRM stores only hashed values.',
  })
})

securityRouter.get('/audit-logs', requireRole('admin', 'partner'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const logs = db
    .prepare(
      `SELECT id, actor_name, action, resource_type, resource_id, detail, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
  res.json(logs)
})

/**
 * Permanent change history for every create/update/delete across the database.
 * Filterable by API key slot (1–5), resource type, or specific record id so
 * daily edits by any of the five key holders can be reviewed.
 */
securityRouter.get('/change-history', requireManager, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const slot = req.query.slot ? Number(req.query.slot) : null
  const resourceType = typeof req.query.resourceType === 'string' ? req.query.resourceType : null
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : null

  const clauses: string[] = []
  const params: unknown[] = []
  if (slot && slot >= 1 && slot <= 5) {
    clauses.push('api_key_slot = ?')
    params.push(slot)
  }
  if (resourceType) {
    clauses.push('resource_type = ?')
    params.push(resourceType)
  }
  if (resourceId) {
    clauses.push('resource_id = ?')
    params.push(resourceId)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT id, actor_name, api_key_slot, auth_method, resource_type, resource_id,
              change_type, changed_fields, before_json, after_json, created_at
       FROM change_history ${where}
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...params, limit) as Array<{
    id: string
    actor_name: string | null
    api_key_slot: number | null
    auth_method: string
    resource_type: string
    resource_id: string
    change_type: string
    changed_fields: string
    before_json: string | null
    after_json: string | null
    created_at: string
  }>

  res.json({
    count: rows.length,
    changes: rows.map((r) => ({
      id: r.id,
      actorName: r.actor_name,
      apiKeySlot: r.api_key_slot,
      authMethod: r.auth_method,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      changeType: r.change_type,
      changedFields: JSON.parse(r.changed_fields || '[]') as string[],
      before: r.before_json ? (JSON.parse(r.before_json) as Record<string, unknown>) : null,
      after: r.after_json ? (JSON.parse(r.after_json) as Record<string, unknown>) : null,
      createdAt: r.created_at,
    })),
  })
})

securityRouter.get('/me', (req, res) => {
  res.json({
    userId: req.auth!.userId,
    userName: req.auth!.userName,
    role: req.auth!.role,
    authMethod: req.auth!.authMethod,
    apiKeyId: req.auth!.apiKeyId ?? null,
    apiKeySlot: req.auth!.apiKeySlot ?? null,
    isManager: Boolean(req.auth!.isManager),
  })
})

/** Active sessions — manager can review who is signed in. */
securityRouter.get('/sessions', requireManager, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.auth_method, s.api_key_id, s.ip_address, s.expires_at, s.created_at,
              u.name AS user_name, u.email AS user_email,
              k.slot AS api_key_slot, k.label AS api_key_label
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN api_keys k ON k.id = s.api_key_id
       WHERE datetime(s.expires_at) > datetime('now')
       ORDER BY s.created_at DESC`,
    )
    .all()
  res.json({ sessions: rows })
})

/** Kick / revoke a live session. */
securityRouter.delete('/sessions/:id', requireManager, (req, res) => {
  const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Session not found' })
  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'session.kick',
    'session',
    req.params.id,
    'Session terminated by managerial key',
    req,
  )
  res.json({ ok: true })
})

/** Revoke one of the 5 API key slots (boots that key permanently until re-provisioned). */
securityRouter.post('/api-keys/:slot/revoke', requireManager, (req, res) => {
  const slot = Number(req.params.slot)
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
    return res.status(400).json({ error: 'Slot must be 1–5' })
  }
  const key = db.prepare(`SELECT id, status FROM api_keys WHERE slot = ?`).get(slot) as
    | { id: string; status: string }
    | undefined
  if (!key) return res.status(404).json({ error: 'Slot not found' })

  // Keep key_hash so a later login attempt is recognized as revoked (not "unknown")
  db.prepare(
    `UPDATE api_keys SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`,
  ).run(key.id)
  // Kick any sessions that used this key — they cannot keep working after revoke
  const kicked = db.prepare(`DELETE FROM sessions WHERE api_key_id = ?`).run(key.id)

  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'api_key.revoke',
    'api_key',
    key.id,
    `Revoked slot ${slot}; terminated ${kicked.changes} session(s). Future logins with this key are denied.`,
    req,
  )
  res.json({
    ok: true,
    slot,
    status: 'revoked',
    sessionsTerminated: kicked.changes,
    notice: 'This key can no longer sign in. Provision the slot again to issue a replacement.',
  })
})

const provisionSchema = z.object({
  label: z.string().min(2).max(120).optional(),
})

/**
 * Provision (or rotate) a key into a slot. Returns plaintext once —
 * only the hash is stored. Managerial key required.
 */
securityRouter.post('/api-keys/:slot/provision', requireManager, (req, res) => {
  const slot = Number(req.params.slot)
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
    return res.status(400).json({ error: 'Slot must be 1–5' })
  }
  const parsed = provisionSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const key = db.prepare(`SELECT id FROM api_keys WHERE slot = ?`).get(slot) as
    | { id: string }
    | undefined
  if (!key) return res.status(404).json({ error: 'Slot not found' })

  const plaintext = `nwp_slot${slot}_${randomBytes(18).toString('base64url')}`
  const prefix = plaintext.slice(0, 12)
  const label = parsed.data.label?.trim() || `Provisioned slot ${slot}`

  db.prepare(
    `UPDATE api_keys
     SET label = ?, key_prefix = ?, key_hash = ?, status = 'active',
         created_by = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(label, prefix, hashToken(plaintext), req.auth!.userId, key.id)

  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'api_key.provision',
    'api_key',
    key.id,
    `Provisioned slot ${slot}`,
    req,
  )

  res.status(201).json({
    slot,
    label,
    keyPrefix: prefix,
    status: 'active',
    plaintext,
    notice: 'Copy this key now. It will not be shown again — only the hash is stored.',
  })
})

securityRouter.get('/manager', requireManager, (_req, res) => {
  const mgr = db
    .prepare(
      `SELECT id, label, holder_name, key_prefix, status, last_used_at, created_at
       FROM manager_keys WHERE status = 'active' LIMIT 1`,
    )
    .get()
  res.json({ manager: mgr })
})

/** Work-email style notification feed */
securityRouter.get('/notifications', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 100)
  const rows = db
    .prepare(
      `SELECT id, direction, from_address, to_address, subject, body, read_flag, related_project, created_at
       FROM notifications ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
  res.json({
    notifications: rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        direction: row.direction,
        from: row.from_address,
        to: row.to_address,
        subject: row.subject,
        body: row.body,
        read: Boolean(row.read_flag),
        relatedProject: row.related_project,
        createdAt: row.created_at,
      }
    }),
  })
})

const notifySchema = z.object({
  to: z.string().email().or(z.string().min(3).max(200)),
  subject: z.string().min(1).max(300),
  body: z.string().max(5000).default(''),
  relatedProject: z.string().max(120).optional(),
})

securityRouter.post('/notifications', (req, res) => {
  const parsed = notifySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid notification payload' })

  const from =
    req.auth!.userId === 'user-manager'
      ? 'samad@newportspecialty.demo'
      : 'dennis@newportspecialty.demo'
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  db.prepare(
    `INSERT INTO notifications (id, direction, from_address, to_address, subject, body, read_flag, related_project)
     VALUES (?, 'outbound', ?, ?, ?, ?, 1, ?)`,
  ).run(
    id,
    from,
    parsed.data.to,
    parsed.data.subject,
    parsed.data.body,
    parsed.data.relatedProject ?? '',
  )

  writeAudit(
    req.auth!.userId,
    req.auth!.userName,
    'notification.send',
    'notification',
    id,
    `To ${parsed.data.to}: ${parsed.data.subject}`,
    req,
  )

  res.status(201).json({
    id,
    direction: 'outbound',
    from,
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
    read: true,
    relatedProject: parsed.data.relatedProject ?? '',
    createdAt: new Date().toISOString(),
    // Best-effort: clients may open a mailto: compose window for the work mailbox
    mailto: `mailto:${encodeURIComponent(parsed.data.to)}?subject=${encodeURIComponent(parsed.data.subject)}&body=${encodeURIComponent(parsed.data.body)}`,
  })
})

securityRouter.post('/notifications/:id/read', (req, res) => {
  db.prepare(`UPDATE notifications SET read_flag = 1 WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})
