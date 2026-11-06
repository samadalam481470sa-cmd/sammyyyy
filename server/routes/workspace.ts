import express, { Router } from 'express'
import { z } from 'zod'
import { db, createSessionToken, hashToken } from '../db/index.ts'
import { aiRateLimit, authRateLimit, fileWriteLimit, lockoutGuard, recordAuthFailure, clearAuthFailures, requireAuth, workspaceWriteLimit, writeAudit } from '../middleware/security.ts'
import { STRIKES, addStrikes, logDefenseEvent, uploadProblem } from '../middleware/defense.ts'
import { changedFields, deadLeadReferences, leadDependencies, protectLeadIdentity } from '../services/workspaceRules.ts'
import { accessPolicy, isAllowed, verifyMicrosoftIdToken } from '../services/microsoftToken.ts'
import { SummaryUnavailable, meetingSummaryProvider, summarizeTranscript } from '../services/meetingSummary.ts'
import { geminiModel, geminiReachability, geminiSelfTest } from '../services/gemini.ts'

/**
 * Shared company workspace: every approved Newport user reads and writes the same records.
 * Records are stored per collection and id, so two people editing different records never
 * overwrite each other. Clients pull changes since their last sync.
 */
export const workspaceRouter = Router()
export const microsoftAuthRouter = Router()

export const WORKSPACE_COLLECTIONS = ['opportunities', 'tasks', 'documents', 'contacts', 'dealLeads', 'activity', 'documentTypes'] as const
const SESSION_HOURS = 12
const MAX_SESSIONS_PER_USER = 10
/** Keeps a stolen account or a runaway client from filling the server's disk. */
const FILE_STORE_LIMIT = 5 * 1024 * 1024 * 1024

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
    `INSERT INTO sessions (id, user_id, token_hash, auth_method, expires_at, ip_address, user_agent, auth_subject) VALUES (?, ?, ?, 'microsoft', ?, ?, ?, ?)`,
  ).run(sessionId, user.id, hashToken(token), expiresAt, req.ip ?? null, (req.get('user-agent') ?? '').slice(0, 300) || null, identity.objectId || null)
  // The oldest sessions end first, so old or stolen tokens do not pile up forever.
  db.prepare(
    `DELETE FROM sessions WHERE user_id = ? AND id NOT IN (SELECT id FROM sessions WHERE user_id = ? ORDER BY datetime(created_at) DESC, rowid DESC LIMIT ?)`,
  ).run(user.id, user.id, MAX_SESSIONS_PER_USER)
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
        /** Revision this edit was based on; 0 means a new record. Sent by every current client. */
        baseRev: z.number().int().min(0).optional(),
      }),
    )
    .max(500),
  /** Set on a reviewed import, so its records can be traced in the audit trail. */
  batchId: z.string().max(80).optional(),
})

interface RecordRow {
  collection: string
  id: string
  data: string
  deleted: number
  updated_at: string
  updated_by: string
  rev: number
}

const parseRecord = (json: string) => JSON.parse(json) as Record<string, unknown>
const present = (row: RecordRow) => ({
  collection: row.collection,
  id: row.id,
  deleted: row.deleted === 1,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  rev: row.rev,
  data: row.deleted === 1 ? null : parseRecord(row.data),
})

function liveRows(collection: string): Record<string, unknown>[] {
  const rows = db.prepare(`SELECT data FROM workspace_records WHERE collection = ? AND deleted = 0`).all(collection) as { data: string }[]
  return rows.map((row) => parseRecord(row.data))
}

function appendRecordAudit(input: { actorId: string | null; actor: string; collection: string; id: string; action: string; fields?: string[]; rev: number | null; batchId?: string; at?: string }) {
  db.prepare(
    `INSERT INTO workspace_audit (at, actor_user_id, actor_name, collection, record_id, action, changed_fields, rev, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(input.at ?? new Date().toISOString(), input.actorId, input.actor, input.collection, input.id, input.action, JSON.stringify(input.fields ?? []), input.rev, input.batchId ?? null)
}

// Private meeting rows left by older builds are in the 'meetings' collection. No one reads them through this route.
workspaceRouter.get('/', requireAuth, (req, res) => {
  const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(req.query.since) ? req.query.since : null
  const serverTime = new Date().toISOString()
  const rows = (since
    ? db.prepare(`SELECT collection, id, data, deleted, updated_at, updated_by, rev FROM workspace_records WHERE updated_at >= ? AND collection != 'meetings' ORDER BY updated_at`).all(since)
    : db.prepare(`SELECT collection, id, data, deleted, updated_at, updated_by, rev FROM workspace_records WHERE deleted = 0 AND collection != 'meetings'`).all()) as RecordRow[]
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM workspace_records WHERE collection != 'meetings'`).get() as { c: number }).c
  res.json({ serverTime, empty: total === 0, records: rows.map(present) })
})

workspaceRouter.post('/changes', requireAuth, workspaceWriteLimit, (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const parsed = changeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid changes.' })
  const now = new Date().toISOString()
  const actor = req.auth?.userName ?? 'Newport user'
  const actorId = req.auth?.userId ?? null
  const subject = req.auth?.subject ?? null
  const readExisting = db.prepare(`SELECT collection, id, data, deleted, updated_at, updated_by, rev FROM workspace_records WHERE collection = ? AND id = ?`)
  const upsert = db.prepare(
    `INSERT INTO workspace_records (collection, id, data, deleted, updated_at, updated_by, rev) VALUES (@collection, @id, @data, @deleted, @updatedAt, @actor, @rev)
     ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, updated_by = excluded.updated_by, rev = excluded.rev`,
  )
  const applied: { collection: string; id: string; rev: number; updatedAt: string }[] = []
  const conflicts: ReturnType<typeof present>[] = []
  const blocked: { collection: string; id: string; reason: string }[] = []
  const conflictOn = (row: RecordRow | undefined, collection: string, id: string) =>
    conflicts.push(row ? present(row) : { collection, id, deleted: true, updatedAt: now, updatedBy: '', rev: 0, data: null })
  const isDeadLead = (leadId: string) => {
    const row = readExisting.get('dealLeads', leadId) as RecordRow | undefined
    return Boolean(row && row.deleted === 1)
  }

  const apply = db.transaction(() => {
    for (const change of parsed.data.changes) {
      const row = readExisting.get(change.collection, change.id) as RecordRow | undefined
      const currentRev = row?.rev ?? 0
      const existingLive = row && row.deleted === 0 ? parseRecord(row.data) : null
      // Someone saved this record after this person loaded it. Nothing is overwritten; the client merges.
      if (change.baseRev !== undefined && change.baseRev !== currentRev) {
        if (!(change.data === null && !existingLive)) conflictOn(row, change.collection, change.id)
        continue
      }
      if (change.data === null && !row) continue
      // A used lead can never be removed by a stale screen. Removal goes through its own checked route.
      if (change.collection === 'dealLeads' && change.data === null) {
        conflictOn(row, change.collection, change.id)
        continue
      }
      let incoming = change.data
      if (incoming && change.collection === 'dealLeads') incoming = protectLeadIdentity(incoming, existingLive, subject)
      // A deal or task cannot pick up a lead that was deleted while this screen was open.
      if (incoming && (change.collection === 'opportunities' || change.collection === 'tasks')) {
        const dead = deadLeadReferences(change.collection, incoming, existingLive).filter(isDeadLead)
        if (dead.length) {
          blocked.push({ collection: change.collection, id: change.id, reason: 'That deal lead was deleted. Choose another lead.' })
          conflictOn(row, change.collection, change.id)
          continue
        }
      }
      const data = incoming == null ? '{}' : JSON.stringify({ ...incoming, id: change.id })
      if (data.length > 400_000) throw new Error('Record too large')
      const rev = currentRev + 1
      upsert.run({ collection: change.collection, id: change.id, data, deleted: incoming == null ? 1 : 0, updatedAt: now, actor, rev })
      applied.push({ collection: change.collection, id: change.id, rev, updatedAt: now })
      if (change.collection !== 'activity' || !row) {
        const action = incoming == null ? 'delete' : !existingLive ? (row ? 'restore' : 'create') : 'update'
        appendRecordAudit({ actorId, actor, collection: change.collection, id: change.id, action, fields: changedFields(existingLive, incoming), rev, batchId: parsed.data.batchId, at: now })
      }
    }
  })
  try {
    apply()
  } catch {
    return res.status(400).json({ error: 'A record is too large to save.' })
  }
  writeAudit(actorId, actor, 'workspace.changes', 'workspace', null, `${applied.length} applied, ${conflicts.length} conflict(s)`, req)
  res.json({ ok: true, serverTime: now, applied, conflicts, blocked, rejected: [] })
})

/** The audit trail for one record. Shared records only; private meetings never appear here. */
workspaceRouter.get('/audit/:collection/:id', requireAuth, (req, res) => {
  const collection = z.enum(WORKSPACE_COLLECTIONS).safeParse(req.params.collection)
  if (!collection.success) return res.status(404).json({ error: 'No such record.' })
  const rows = db
    .prepare(`SELECT at, actor_name AS actor, action, changed_fields AS fields, rev FROM workspace_audit WHERE collection = ? AND record_id = ? ORDER BY id DESC LIMIT 200`)
    .all(collection.data, req.params.id) as { at: string; actor: string; action: string; fields: string; rev: number }[]
  res.json({ events: rows.map((row) => ({ ...row, fields: JSON.parse(row.fields) as string[] })) })
})

// ── Deal Lead removal: checked on the server, in one transaction ────────────

const DEAL_LEAD_UNDO_MS = 60_000

workspaceRouter.get('/deal-leads/:id/dependencies', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT data, deleted FROM workspace_records WHERE collection = 'dealLeads' AND id = ?`).get(req.params.id) as { data: string; deleted: number } | undefined
  if (!row || row.deleted) return res.status(404).json({ error: 'That deal lead is no longer on the roster.' })
  res.json(leadDependencies(parseRecord(row.data), liveRows('opportunities'), liveRows('tasks')))
})

workspaceRouter.delete('/deal-leads/:id', requireAuth, workspaceWriteLimit, (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const actor = req.auth?.userName ?? 'Newport user'
  const now = new Date().toISOString()
  const remove = db.transaction(() => {
    const row = db.prepare(`SELECT data, deleted, rev FROM workspace_records WHERE collection = 'dealLeads' AND id = ?`).get(req.params.id) as { data: string; deleted: number; rev: number } | undefined
    if (!row || row.deleted) return { status: 404 as const, body: { error: 'That deal lead is no longer on the roster.' } }
    const deps = leadDependencies(parseRecord(row.data), liveRows('opportunities'), liveRows('tasks'))
    if (deps.total > 0) return { status: 409 as const, body: { error: 'This deal lead is still in use.', dependencies: deps } }
    const rev = row.rev + 1
    // The row stays as a tombstone with its data, so Undo can restore it and other devices learn it was removed.
    db.prepare(`UPDATE workspace_records SET deleted = 1, rev = ?, updated_at = ?, updated_by = ? WHERE collection = 'dealLeads' AND id = ?`).run(rev, now, actor, req.params.id)
    appendRecordAudit({ actorId: req.auth?.userId ?? null, actor, collection: 'dealLeads', id: req.params.id, action: 'delete', rev, at: now })
    return { status: 200 as const, body: { ok: true, rev, serverTime: now, undoUntil: new Date(Date.now() + DEAL_LEAD_UNDO_MS).toISOString() } }
  })
  const result = remove()
  res.status(result.status).json(result.body)
})

workspaceRouter.post('/deal-leads/:id/restore', requireAuth, workspaceWriteLimit, (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const actor = req.auth?.userName ?? 'Newport user'
  const now = new Date().toISOString()
  const restore = db.transaction(() => {
    const row = db.prepare(`SELECT data, deleted, rev, updated_at FROM workspace_records WHERE collection = 'dealLeads' AND id = ?`).get(req.params.id) as { data: string; deleted: number; rev: number; updated_at: string } | undefined
    if (!row || !row.deleted) return { status: 404 as const, body: { error: 'There is nothing to restore.' } }
    if (Date.now() - Date.parse(row.updated_at) > DEAL_LEAD_UNDO_MS) return { status: 410 as const, body: { error: 'The time to undo this delete has passed.' } }
    const rev = row.rev + 1
    db.prepare(`UPDATE workspace_records SET deleted = 0, rev = ?, updated_at = ?, updated_by = ? WHERE collection = 'dealLeads' AND id = ?`).run(rev, now, actor, req.params.id)
    appendRecordAudit({ actorId: req.auth?.userId ?? null, actor, collection: 'dealLeads', id: req.params.id, action: 'restore', rev, at: now })
    return { status: 200 as const, body: { ok: true, rev, serverTime: now, lead: parseRecord(row.data) } }
  })
  const result = restore()
  res.status(result.status).json(result.body)
})

// ── Private meetings: every query is filtered by the verified account ────────

const MEETING_FILE_LIMIT = 25 * 1024 * 1024
const MEETING_STORE_PER_USER = 1024 * 1024 * 1024
const meetingId = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
const meetingFileKind = z.enum(['text', 'source'])

/** Private data needs a verified Microsoft account. A session without one gets nothing. */
function ownerOf(req: express.Request): string | null {
  return req.auth?.subject || null
}
const notFound = (res: express.Response) => res.status(404).json({ error: 'No such meeting.' })

workspaceRouter.get('/meetings', requireAuth, (req, res) => {
  const owner = ownerOf(req)
  if (!owner) return res.status(403).json({ error: 'Private meetings need a Microsoft sign-in.' })
  const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(req.query.since) ? req.query.since : null
  const opportunityId = typeof req.query.opportunityId === 'string' ? req.query.opportunityId : null
  const rows = (since
    ? db.prepare(`SELECT id, data, deleted, rev, updated_at FROM private_meetings WHERE owner_subject = ? AND updated_at >= ?`).all(owner, since)
    : db.prepare(`SELECT id, data, deleted, rev, updated_at FROM private_meetings WHERE owner_subject = ? AND deleted = 0`).all(owner)) as { id: string; data: string; deleted: number; rev: number; updated_at: string }[]
  const records = rows
    .map((row) => ({ id: row.id, deleted: row.deleted === 1, rev: row.rev, updatedAt: row.updated_at, data: row.deleted === 1 ? null : parseRecord(row.data) }))
    .filter((row) => !opportunityId || row.data?.opportunityId === opportunityId)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ serverTime: new Date().toISOString(), records })
})

workspaceRouter.get('/meetings/:id', requireAuth, (req, res) => {
  const owner = ownerOf(req)
  const id = meetingId.safeParse(req.params.id)
  if (!owner || !id.success) return notFound(res)
  const row = db.prepare(`SELECT data, rev, updated_at FROM private_meetings WHERE owner_subject = ? AND id = ? AND deleted = 0`).get(owner, id.data) as { data: string; rev: number; updated_at: string } | undefined
  if (!row) return notFound(res)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ id: id.data, rev: row.rev, updatedAt: row.updated_at, data: parseRecord(row.data) })
})

workspaceRouter.put('/meetings/:id', requireAuth, workspaceWriteLimit, (req, res) => {
  const owner = ownerOf(req)
  const id = meetingId.safeParse(req.params.id)
  if (!owner) return res.status(403).json({ error: 'Private meetings need a Microsoft sign-in.' })
  if (!id.success) return res.status(400).json({ error: 'Invalid meeting id.' })
  const parsed = z.object({ data: z.record(z.string(), z.unknown()), baseRev: z.number().int().min(0).optional() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid meeting.' })
  const json = JSON.stringify({ ...parsed.data.data, id: id.data })
  if (json.length > 400_000) return res.status(413).json({ error: 'This meeting record is too large to save.' })
  const now = new Date().toISOString()
  const row = db.prepare(`SELECT data, deleted, rev, updated_at FROM private_meetings WHERE owner_subject = ? AND id = ?`).get(owner, id.data) as { data: string; deleted: number; rev: number; updated_at: string } | undefined
  if (parsed.data.baseRev !== undefined && parsed.data.baseRev !== (row?.rev ?? 0)) {
    return res.status(409).json({ conflict: true, rev: row?.rev ?? 0, deleted: row?.deleted === 1, updatedAt: row?.updated_at, data: row && !row.deleted ? parseRecord(row.data) : null })
  }
  const rev = (row?.rev ?? 0) + 1
  db.prepare(
    `INSERT INTO private_meetings (owner_subject, id, data, deleted, rev, updated_at) VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(owner_subject, id) DO UPDATE SET data = excluded.data, deleted = 0, rev = excluded.rev, updated_at = excluded.updated_at`,
  ).run(owner, id.data, json, rev, now)
  // The shared audit log records that a private record changed, with no title, link or content.
  writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'meeting.private_save', 'meeting', null, 'Private meeting saved', req)
  res.json({ ok: true, rev, updatedAt: now })
})

workspaceRouter.delete('/meetings/:id', requireAuth, workspaceWriteLimit, (req, res) => {
  const owner = ownerOf(req)
  const id = meetingId.safeParse(req.params.id)
  if (!owner || !id.success) return notFound(res)
  const now = new Date().toISOString()
  const done = db.transaction(() => {
    const row = db.prepare(`SELECT rev FROM private_meetings WHERE owner_subject = ? AND id = ? AND deleted = 0`).get(owner, id.data) as { rev: number } | undefined
    if (!row) return false
    // The tombstone carries no content; other devices of this person learn it was removed.
    db.prepare(`UPDATE private_meetings SET data = '{}', deleted = 1, rev = ?, updated_at = ? WHERE owner_subject = ? AND id = ?`).run(row.rev + 1, now, owner, id.data)
    db.prepare(`DELETE FROM private_meeting_files WHERE owner_subject = ? AND meeting_id = ?`).run(owner, id.data)
    return true
  })()
  if (!done) return notFound(res)
  writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'meeting.private_delete', 'meeting', null, 'Private meeting removed', req)
  res.json({ ok: true })
})

workspaceRouter.put('/meetings/:id/files/:kind', requireAuth, fileWriteLimit, express.raw({ type: () => true, limit: MEETING_FILE_LIMIT }), (req, res) => {
  const owner = ownerOf(req)
  const id = meetingId.safeParse(req.params.id)
  const kind = meetingFileKind.safeParse(req.params.kind)
  if (!owner) return res.status(403).json({ error: 'Private meetings need a Microsoft sign-in.' })
  if (!id.success || !kind.success || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Invalid file.' })
  let name = 'transcript'
  try {
    name = decodeURIComponent(String(req.get('x-file-name') ?? 'transcript'))
  } catch {
    // A malformed name falls back to the plain one.
  }
  name = name.replace(/[\\/\r\n"\0]/g, '_').slice(0, 200) || 'transcript'
  const used = (db.prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM private_meeting_files WHERE owner_subject = ? AND NOT (meeting_id = ? AND kind = ?)`).get(owner, id.data, kind.data) as { total: number }).total
  if (used + req.body.length > MEETING_STORE_PER_USER) return res.status(507).json({ error: 'Your private transcript storage is full. Remove older transcripts first.' })
  const type = String(req.get('content-type') ?? 'application/octet-stream').slice(0, 120)
  db.prepare(
    `INSERT INTO private_meeting_files (owner_subject, meeting_id, kind, name, content_type, size, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_subject, meeting_id, kind) DO UPDATE SET name = excluded.name, content_type = excluded.content_type, size = excluded.size, data = excluded.data, updated_at = excluded.updated_at`,
  ).run(owner, id.data, kind.data, name, type, req.body.length, req.body, new Date().toISOString())
  res.json({ ok: true, size: req.body.length })
})

workspaceRouter.get('/meetings/:id/files/:kind', requireAuth, (req, res) => {
  const owner = ownerOf(req)
  const id = meetingId.safeParse(req.params.id)
  const kind = meetingFileKind.safeParse(req.params.kind)
  if (!owner || !id.success || !kind.success) return notFound(res)
  const row = db.prepare(`SELECT name, content_type, data FROM private_meeting_files WHERE owner_subject = ? AND meeting_id = ? AND kind = ?`).get(owner, id.data, kind.data) as { name: string; content_type: string; data: Buffer } | undefined
  if (!row) return notFound(res)
  res.setHeader('Content-Type', row.content_type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name)}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(row.data)
})

const FILE_LIMIT = 25 * 1024 * 1024
const fileId = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
/** Older builds copied private transcripts into the shared file store. Those rows are closed to everyone. */
const isLegacyTranscript = (id: string) => id.startsWith('meeting-transcript-')

/** Uploaded document files, shared with every approved user (not just the uploader's browser). */
workspaceRouter.put('/files/:docId', requireAuth, fileWriteLimit, express.raw({ type: () => true, limit: FILE_LIMIT }), (req, res) => {
  if (req.auth?.role === 'viewer') return res.status(403).json({ error: 'Your account can view records but not change them.' })
  const id = fileId.safeParse(req.params.docId)
  if (!id.success || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Invalid file.' })
  if (isLegacyTranscript(id.data)) return res.status(403).json({ error: 'Transcripts are private and cannot be stored as shared files.' })
  const rawName = String(req.get('x-file-name') ?? 'file')
  let decodedName = rawName
  try {
    decodedName = decodeURIComponent(rawName)
  } catch {
    // A malformed name is kept as sent, and made safe below.
  }
  const name = decodedName.replace(/[\\/\r\n"\0]/g, '_').slice(0, 200) || 'file'
  const problem = uploadProblem(name, req.body)
  if (problem) {
    logDefenseEvent('bad_upload', req, name)
    addStrikes(req, STRIKES.badUpload, 'bad_upload')
    writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'workspace.file_refused', 'document', id.data, problem, req)
    return res.status(415).json({ error: problem })
  }
  const stored = (db.prepare(`SELECT COALESCE(SUM(size), 0) AS total FROM workspace_files WHERE doc_id != ?`).get(id.data) as { total: number }).total
  if (stored + req.body.length > FILE_STORE_LIMIT) return res.status(507).json({ error: 'The file store is full. Ask an administrator to remove old files.' })
  const type = String(req.get('content-type') ?? 'application/octet-stream').slice(0, 120)
  db.prepare(
    `INSERT INTO workspace_files (doc_id, name, content_type, size, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(doc_id) DO UPDATE SET name = excluded.name, content_type = excluded.content_type, size = excluded.size, data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  ).run(id.data, name, type, req.body.length, req.body, new Date().toISOString(), req.auth?.userName ?? 'Newport user')
  writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'workspace.file_upload', 'document', id.data, `${req.body.length} bytes`, req)
  res.json({ ok: true, size: req.body.length })
})

workspaceRouter.get('/files/:docId', requireAuth, (req, res) => {
  const id = fileId.safeParse(req.params.docId)
  if (!id.success) return res.status(400).json({ error: 'Invalid file id.' })
  if (isLegacyTranscript(id.data)) return res.status(404).json({ error: 'No file is stored for this document.' })
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
  writeAudit(req.auth?.userId ?? null, req.auth?.userName ?? 'Newport user', 'workspace.file_delete', 'document', id.data, 'File removed', req)
  res.json({ ok: true })
})

// ── Meeting summaries (off unless an administrator enables them) ────────────

workspaceRouter.get('/ai/status', requireAuth, (_req, res) => {
  const provider = meetingSummaryProvider()
  res.json({ meetingSummary: Boolean(provider), provider })
})

// Admin check: can this server reach Google's API host at all? No key or CRM data is sent.
workspaceRouter.get('/ai/reachability', requireAuth, aiRateLimit, async (_req, res) => {
  res.json({ model: geminiModel(), reach: await geminiReachability() })
})

// A short connection check an approved user can run from the Meetings page. Returns no secrets.
workspaceRouter.get('/ai/selftest', requireAuth, aiRateLimit, async (_req, res) => {
  res.json(await geminiSelfTest())
})

const summarySchema = z.object({ transcript: z.string().min(1).max(400_000) })

workspaceRouter.post('/ai/meeting-summary', requireAuth, aiRateLimit, async (req, res) => {
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
