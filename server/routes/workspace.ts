import express, { Router } from 'express'
import { z } from 'zod'
import { db, createSessionToken, hashToken } from '../db/index.ts'
import { authRateLimit, lockoutGuard, recordAuthFailure, clearAuthFailures, requireAuth, writeAudit } from '../middleware/security.ts'
import { accessPolicy, isAllowed, verifyMicrosoftIdToken } from '../services/microsoftToken.ts'
import { SummaryUnavailable, meetingSummaryProvider, summarizeTranscript } from '../services/meetingSummary.ts'
import { geminiModel, geminiReachability } from '../services/gemini.ts'

/**
 * Shared company workspace: every approved Newport user reads and writes the same records.
 * Records are stored per collection and id, so two people editing different records never
 * overwrite each other. Clients pull changes since their last sync.
 */
export const workspaceRouter = Router()
export const microsoftAuthRouter = Router()

export const WORKSPACE_COLLECTIONS = ['opportunities', 'tasks', 'documents', 'contacts', 'activity', 'documentTypes', 'meetings'] as const
const SESSION_HOURS = 12

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] ?? '?'}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

microsoftAuthRouter.post('/microsoft', authRateLimit, lockoutGuard, async (req, res) => {
  const parsed = z.object({ idToken: z.string().min(100).max(20000) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'A Microsoft ID token is required.' })
  let identity
  try {
    identity = await verifyMicrosoftIdToken(parsed.data.idToken)
  } catch {
    recordAuthFailure(req.ip, req)
    writeAudit(null, 'anonymous', 'auth.microsoft_rejected', 'session', null, 'Invalid Microsoft token', req)
    return res.status(401).json({ error: 'Microsoft sign-in could not be verified. Sign in again.' })
  }
  const policy = accessPolicy()
  if (!isAllowed(identity, policy)) {
    writeAudit(null, identity.email, 'auth.microsoft_not_approved', 'session', null, `Not on the approved list (tenant ${identity.tenantId})`, req)
    return res.status(403).json({ error: `${identity.email} is not approved for the Newport CRM. Ask an administrator to add you.` })
  }
  clearAuthFailures(req.ip)

  const role = policy.admins.includes(identity.email) ? 'admin' : 'partner'
  const existing = db.prepare(`SELECT id, role FROM users WHERE email = ?`).get(identity.email) as { id: string; role: string } | undefined
  const userId = existing?.id ?? `ms-${identity.objectId || identity.email}`
  if (existing) {
    db.prepare(`UPDATE users SET name = ?, initials = ?, role = CASE WHEN ? = 'admin' THEN 'admin' ELSE role END, updated_at = datetime('now') WHERE id = ?`).run(identity.name, initials(identity.name), role, existing.id)
  } else {
    db.prepare(`INSERT INTO users (id, email, name, role, initials, password_hash) VALUES (?, ?, ?, ?, ?, NULL)`).run(userId, identity.email, identity.name, role, initials(identity.name))
  }
  const user = db.prepare(`SELECT id, email, name, role, initials FROM users WHERE id = ?`).get(userId) as { id: string; email: string; name: string; role: string; initials: string }

  db.prepare(`DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')`).run()
  const token = createSessionToken()
  const sessionId = `sess_ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString()
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, auth_method, expires_at, ip_address, user_agent) VALUES (?, ?, ?, 'microsoft', ?, ?, ?)`,
  ).run(sessionId, user.id, hashToken(token), expiresAt, req.ip ?? null, req.get('user-agent') ?? null)
  writeAudit(user.id, user.name, 'auth.microsoft_signin', 'session', sessionId, `Microsoft sign-in (tenant ${identity.tenantId})`, req)
  res.json({ token, expiresAt, user: { ...user, authMethod: 'microsoft' } })
})

const changeSchema = z.object({
  changes: z
    .array(
      z.object({
        collection: z.enum(WORKSPACE_COLLECTIONS),
        id: z.string().min(1).max(200),
        /** null deletes the record. */
        data: z.record(z.string(), z.unknown()).nullable(),
      }),
    )
    .max(500),
})

workspaceRouter.get('/', requireAuth, (req, res) => {
  const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(req.query.since) ? req.query.since : null
  const serverTime = new Date().toISOString()
  const rows = (since
    ? db.prepare(`SELECT collection, id, data, deleted, updated_at, updated_by FROM workspace_records WHERE updated_at >= ? ORDER BY updated_at`).all(since)
    : db.prepare(`SELECT collection, id, data, deleted, updated_at, updated_by FROM workspace_records WHERE deleted = 0`).all()) as {
    collection: string
    id: string
    data: string
    deleted: number
    updated_at: string
    updated_by: string
  }[]
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM workspace_records`).get() as { c: number }).c
  res.json({
    serverTime,
    empty: total === 0,
    records: rows.map((row) => ({
      collection: row.collection,
      id: row.id,
      deleted: row.deleted === 1,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      data: row.deleted === 1 ? null : JSON.parse(row.data),
    })),
  })
})

workspaceRouter.post('/changes', requireAuth, (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const parsed = changeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid changes.' })
  const now = new Date().toISOString()
  const actor = req.auth?.userName ?? 'Newport user'
  const upsert = db.prepare(
    `INSERT INTO workspace_records (collection, id, data, deleted, updated_at, updated_by) VALUES (@collection, @id, @data, @deleted, @updatedAt, @actor)
     ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
  const apply = db.transaction(() => {
    for (const change of parsed.data.changes) {
      const data = change.data == null ? '{}' : JSON.stringify({ ...change.data, id: change.id })
      if (data.length > 400_000) throw new Error('Record too large')
      upsert.run({ collection: change.collection, id: change.id, data, deleted: change.data == null ? 1 : 0, updatedAt: now, actor })
    }
  })
  try {
    apply()
  } catch {
    return res.status(400).json({ error: 'A record is too large to save.' })
  }
  writeAudit(req.auth?.userId ?? null, actor, 'workspace.changes', 'workspace', null, `${parsed.data.changes.length} record change(s)`, req)
  res.json({ ok: true, serverTime: now })
})

const FILE_LIMIT = 25 * 1024 * 1024
const fileId = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)

/** Uploaded document files, shared with every approved user (not just the uploader's browser). */
workspaceRouter.put('/files/:docId', requireAuth, express.raw({ type: () => true, limit: FILE_LIMIT }), (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const id = fileId.safeParse(req.params.docId)
  if (!id.success || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Invalid file.' })
  const name = String(req.get('x-file-name') ?? 'file').replace(/[\\/\r\n"]/g, '_').slice(0, 200)
  const type = String(req.get('content-type') ?? 'application/octet-stream').slice(0, 120)
  db.prepare(
    `INSERT INTO workspace_files (doc_id, name, content_type, size, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(doc_id) DO UPDATE SET name = excluded.name, content_type = excluded.content_type, size = excluded.size, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).run(id.data, decodeURIComponent(name), type, req.body.length, req.body, new Date().toISOString(), req.auth?.userName ?? 'Newport user')
  writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'workspace.file_upload', 'document', id.data, `${req.body.length} bytes`, req)
  res.json({ ok: true, size: req.body.length })
})

workspaceRouter.get('/files/:docId', requireAuth, (req, res) => {
  const id = fileId.safeParse(req.params.docId)
  if (!id.success) return res.status(400).json({ error: 'Invalid file id.' })
  const row = db.prepare(`SELECT name, content_type, data FROM workspace_files WHERE doc_id = ?`).get(id.data) as { name: string; content_type: string; data: Buffer } | undefined
  if (!row) return res.status(404).json({ error: 'No file is stored for this document.' })
  res.setHeader('Content-Type', row.content_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name)}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(row.data)
})

workspaceRouter.delete('/files/:docId', requireAuth, (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const id = fileId.safeParse(req.params.docId)
  if (!id.success) return res.status(400).json({ error: 'Invalid file id.' })
  db.prepare(`DELETE FROM workspace_files WHERE doc_id = ?`).run(id.data)
  res.json({ ok: true })
})

// ── Meeting summaries (off unless an administrator enables them) ────────────

workspaceRouter.get('/ai/status', requireAuth, (_req, res) => {
  const provider = meetingSummaryProvider()
  res.json({ meetingSummary: Boolean(provider), provider })
})

// Admin check: can this server reach Google's API host at all? No key or CRM data is sent.
workspaceRouter.get('/ai/reachability', requireAuth, async (_req, res) => {
  res.json({ model: geminiModel(), reach: await geminiReachability() })
})

const summarySchema = z.object({ transcript: z.string().min(1).max(400_000) })

workspaceRouter.post('/ai/meeting-summary', requireAuth, async (req, res) => {
  const parsed = summarySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Send the transcript text.' })
  try {
    const result = await summarizeTranscript(parsed.data.transcript)
    // The audit records that a summary ran, never the transcript itself.
    writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'ai.meeting_summary', 'meeting', null, `${parsed.data.transcript.length} chars via ${result.provider}`, req)
    res.json(result)
  } catch (err) {
    if (err instanceof SummaryUnavailable) return res.status(503).json({ error: err.message, code: 'not_configured' })
    res.status(502).json({ error: err instanceof Error ? err.message : 'The summary could not be created.' })
  }
})
