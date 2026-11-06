// @vitest-environment node
/**
 * Two independent signed-in sessions against the real API and a real database file.
 * This proves privacy and conflicts at the endpoint, not by hidden UI.
 */
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newport-workspace-'))
process.env.CRM_DB_PATH = path.join(dir, 'test.db')
process.env.CRM_BACKUP_DIR = path.join(dir, 'backups')
process.env.ALLOWED_EMAILS = 'a@newport.test'

type Db = typeof import('../db/index.ts')
let db: Db['db']
let hashToken: Db['hashToken']
let server: Server
let base = ''
let ipCounter = 10

function session(subject: string | null, name: string, role = 'partner') {
  const id = `user-${Math.random().toString(36).slice(2)}`
  db.prepare(`INSERT INTO users (id, email, name, role, initials, password_hash) VALUES (?, ?, ?, ?, 'NT', NULL)`).run(id, `${id}@newport.test`, name, role)
  const token = `nwp_sess_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, auth_method, expires_at, auth_subject) VALUES (?, ?, ?, 'microsoft', ?, ?)`).run(
    `sess-${id}`,
    id,
    hashToken(token),
    new Date(Date.now() + 3600_000).toISOString(),
    subject,
  )
  return token
}

/** A new address per call group, so the write limiters do not interfere with the checks. */
const ip = () => `198.51.100.${(ipCounter = ipCounter >= 250 ? 10 : ipCounter + 1)}`
const api = (token: string | null, route: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  headers.set('x-forwarded-for', ip())
  if (init.body && typeof init.body === 'string') headers.set('content-type', 'application/json')
  return fetch(`${base}/api/workspace${route}`, { ...init, headers })
}
const send = (token: string, changes: unknown[], batchId?: string) => api(token, '/changes', { method: 'POST', body: JSON.stringify({ changes, batchId }) }).then((r) => r.json())
const putMeeting = (token: string, id: string, data: unknown, baseRev?: number) => api(token, `/meetings/${id}`, { method: 'PUT', body: JSON.stringify({ data, baseRev }) })

let userA = ''
let userB = ''

beforeAll(async () => {
  const dbModule = await import('../db/index.ts')
  db = dbModule.db
  hashToken = dbModule.hashToken
  const { createApp } = await import('../app.ts')
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve())
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  userA = session('oid-a', 'User A')
  userB = session('oid-b', 'User B')
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('shared records between two people', () => {
  it('one person saves and the other receives it with the actor and revision', async () => {
    const saved = await send(userA, [{ collection: 'opportunities', id: 'opp-1', data: { projectName: 'One', stage: 'Target Identified' }, baseRev: 0 }])
    expect(saved.applied[0]).toMatchObject({ id: 'opp-1', rev: 1 })
    const pulled = await (await api(userB, '/')).json()
    const row = pulled.records.find((r: { id: string }) => r.id === 'opp-1')
    expect(row).toMatchObject({ rev: 1, updatedBy: 'User A', data: { stage: 'Target Identified' } })
  })

  it('an edit based on an old revision is refused and nothing is overwritten', async () => {
    await send(userA, [{ collection: 'tasks', id: 't-1', data: { action: 'First', notes: '' }, baseRev: 0 }])
    await send(userA, [{ collection: 'tasks', id: 't-1', data: { action: 'From A', notes: '' }, baseRev: 1 }])
    const stale = await send(userB, [{ collection: 'tasks', id: 't-1', data: { action: 'From B', notes: '' }, baseRev: 1 }])
    expect(stale.applied).toEqual([])
    expect(stale.conflicts[0]).toMatchObject({ id: 't-1', rev: 2, updatedBy: 'User A', data: { action: 'From A' } })
    const row = db.prepare(`SELECT data, rev FROM workspace_records WHERE collection = 'tasks' AND id = 't-1'`).get() as { data: string; rev: number }
    expect(JSON.parse(row.data).action).toBe('From A')
    expect(row.rev).toBe(2)
  })

  it('a delete stays deleted: a stale edit gets a conflict instead of bringing it back', async () => {
    await send(userA, [{ collection: 'documents', id: 'd-1', data: { name: 'NDA' }, baseRev: 0 }])
    await send(userA, [{ collection: 'documents', id: 'd-1', data: null, baseRev: 1 }])
    const res = await send(userB, [{ collection: 'documents', id: 'd-1', data: { name: 'NDA edited' }, baseRev: 1 }])
    expect(res.conflicts[0]).toMatchObject({ id: 'd-1', deleted: true })
    const pull = await (await api(userB, '/')).json()
    expect(pull.records.some((r: { id: string }) => r.id === 'd-1')).toBe(false)
  })

  it('the audit trail names the verified actor, lists fields without values, and cannot be changed', async () => {
    await send(userA, [{ collection: 'contacts', id: 'c-1', data: { name: 'Pat', phone: '1' }, baseRev: 0 }])
    await send(userB, [{ collection: 'contacts', id: 'c-1', data: { name: 'Pat', phone: '2', actorName: 'Forged Name' }, baseRev: 1 }])
    const { events } = await (await api(userA, '/audit/contacts/c-1')).json()
    expect(events[0]).toMatchObject({ actor: 'User B', action: 'update', rev: 2 })
    expect(events[0].fields).toEqual(['actorName', 'phone'])
    expect(events[1]).toMatchObject({ actor: 'User A', action: 'create' })
    expect(() => db.prepare(`DELETE FROM workspace_audit`).run()).toThrow(/audit trail/)
    expect(() => db.prepare(`UPDATE workspace_audit SET actor_name = 'x'`).run()).toThrow(/audit trail/)
  })
})

describe('private meetings', () => {
  const meeting = { opportunityId: 'opp-1', displayTitle: 'Secret talk', notes: 'private note', recordingUrl: 'https://rec.example/1' }

  it('the owner sees it on a second device; another person cannot reach it by any route', async () => {
    expect((await putMeeting(userA, 'mtg-1', meeting, 0)).status).toBe(200)
    const secondDevice = session('oid-a', 'User A')
    const mine = await (await api(secondDevice, '/meetings')).json()
    expect(mine.records.map((r: { id: string }) => r.id)).toEqual(['mtg-1'])

    expect((await (await api(userB, '/meetings')).json()).records).toEqual([])
    expect((await (await api(userB, '/meetings?opportunityId=opp-1')).json()).records).toEqual([])
    expect((await api(userB, '/meetings/mtg-1')).status).toBe(404)
    expect((await api(userB, '/meetings/mtg-1', { method: 'DELETE' })).status).toBe(404)
    expect((await api(null, '/meetings/mtg-1')).status).toBe(401)
  })

  it('the Opportunity Profile query returns only the current person and that deal', async () => {
    await putMeeting(userA, 'mtg-2', { ...meeting, opportunityId: 'opp-2' }, 0)
    await putMeeting(userB, 'mtg-b', { ...meeting, displayTitle: 'B talk' }, 0)
    const a = await (await api(userA, '/meetings?opportunityId=opp-1')).json()
    expect(a.records.map((r: { id: string }) => r.id)).toEqual(['mtg-1'])
    const b = await (await api(userB, '/meetings?opportunityId=opp-1')).json()
    expect(b.records.map((r: { id: string }) => r.id)).toEqual(['mtg-b'])
  })

  it('the same id from two people makes two separate records', async () => {
    await putMeeting(userB, 'mtg-1', { displayTitle: 'B own' }, 0)
    const a = await (await api(userA, '/meetings/mtg-1')).json()
    const b = await (await api(userB, '/meetings/mtg-1')).json()
    expect(a.data.displayTitle).toBe('Secret talk')
    expect(b.data.displayTitle).toBe('B own')
    await api(userB, '/meetings/mtg-1', { method: 'DELETE' })
    expect((await api(userA, '/meetings/mtg-1')).status).toBe(200)
  })

  it('transcripts are readable only by their owner', async () => {
    const put = await api(userA, '/meetings/mtg-1/files/text', { method: 'PUT', headers: { 'content-type': 'text/plain', 'x-file-name': 'a.txt' }, body: new Blob(['the private words']) })
    expect(put.status).toBe(200)
    expect(await (await api(userA, '/meetings/mtg-1/files/text')).text()).toBe('the private words')
    expect((await api(userB, '/meetings/mtg-1/files/text')).status).toBe(404)
  })

  it('never appears in the shared pull, the shared audit logs, or the shared file route', async () => {
    const pull = JSON.stringify(await (await api(userB, '/')).json())
    expect(pull).not.toContain('Secret talk')
    db.prepare(`INSERT INTO workspace_records (collection, id, data, deleted, updated_at, updated_by) VALUES ('meetings', 'legacy-1', ?, 0, ?, 'Old build')`).run(JSON.stringify({ displayTitle: 'Legacy secret' }), new Date().toISOString())
    db.prepare(`INSERT INTO workspace_files (doc_id, name, content_type, size, data, updated_at, updated_by) VALUES ('meeting-transcript-text-legacy-1', 'x', 'text/plain', 1, ?, ?, 'Old build')`).run(Buffer.from('x'), new Date().toISOString())
    const full = JSON.stringify(await (await api(userB, '/')).json())
    const delta = JSON.stringify(await (await api(userB, '/?since=2000-01-01T00:00:00.000Z')).json())
    expect(full).not.toContain('Legacy secret')
    expect(delta).not.toContain('Legacy secret')
    expect((await api(userB, '/files/meeting-transcript-text-legacy-1')).status).toBe(404)
    expect((await send(userB, [{ collection: 'meetings', id: 'legacy-1', data: { a: 1 } }]).catch(() => null))?.error).toBe('Invalid changes.')
    const logs = JSON.stringify(db.prepare(`SELECT * FROM audit_logs`).all()) + JSON.stringify(db.prepare(`SELECT * FROM workspace_audit`).all())
    expect(logs).not.toContain('Secret talk')
    expect(logs).not.toContain('private note')
    expect(logs).not.toContain('rec.example')
  })

  it('a session without a verified Microsoft account gets no private data', async () => {
    const noSubject = session(null, 'No Account')
    expect((await api(noSubject, '/meetings')).status).toBe(403)
    expect((await putMeeting(noSubject, 'x', {})).status).toBe(403)
  })

  it('an older copy of the same meeting is refused', async () => {
    await putMeeting(userA, 'mtg-3', { notes: 'first' }, 0)
    const second = await putMeeting(userA, 'mtg-3', { notes: 'second' }, 1)
    expect(second.status).toBe(200)
    const stale = await putMeeting(userA, 'mtg-3', { notes: 'old device' }, 1)
    expect(stale.status).toBe(409)
    expect((await stale.json()).data.notes).toBe('second')
  })
})

describe('Deal Leads', () => {
  const lead = (id: string, extra: Record<string, unknown> = {}) => ({ collection: 'dealLeads', id, data: { name: id, jobTitle: '', email: '', phone: '', status: 'Active', authAccountId: null, ...extra } })

  it('any approved person can edit another person\'s lead and change its status', async () => {
    await send(userA, [{ ...lead('lead-edit', { authAccountId: 'oid-a' }), baseRev: 0 }])
    const res = await send(userB, [{ ...lead('lead-edit', { name: 'Renamed', status: 'Inactive', authAccountId: 'oid-a', email: 'new@x.test' }), baseRev: 1 }])
    expect(res.applied).toHaveLength(1)
    const row = JSON.parse((db.prepare(`SELECT data FROM workspace_records WHERE collection = 'dealLeads' AND id = 'lead-edit'`).get() as { data: string }).data)
    expect(row).toMatchObject({ name: 'Renamed', status: 'Inactive', authAccountId: 'oid-a' })
  })

  it('the Microsoft link cannot be moved or taken by editing the record', async () => {
    await send(userA, [{ ...lead('lead-id', { authAccountId: 'oid-a' }), baseRev: 0 }])
    await send(userB, [{ ...lead('lead-id', { authAccountId: 'oid-b' }), baseRev: 1 }])
    await send(userB, [{ ...lead('lead-free', { authAccountId: 'oid-someone-else' }), baseRev: 0 }])
    const read = (id: string) => JSON.parse((db.prepare(`SELECT data FROM workspace_records WHERE collection = 'dealLeads' AND id = ?`).get(id) as { data: string }).data)
    expect(read('lead-id').authAccountId).toBe('oid-a')
    expect(read('lead-free').authAccountId).toBeNull()
  })

  it('a used lead cannot be deleted, and the answer gives exact counts', async () => {
    await send(userA, [
      { ...lead('lead-used', { name: 'Used Lead' }), baseRev: 0 },
      { collection: 'opportunities', id: 'o-p', data: { primaryLeadId: 'lead-used', additionalLeadIds: [], dealLead: 'Used Lead' }, baseRev: 0 },
      { collection: 'opportunities', id: 'o-a', data: { primaryLeadId: null, additionalLeadIds: ['lead-used'], dealLead: '' }, baseRev: 0 },
      { collection: 'tasks', id: 't-o', data: { action: 'x', ownerId: 'lead-used', owner: 'Used Lead' }, baseRev: 0 },
    ])
    const res = await api(userB, '/deal-leads/lead-used', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect((await res.json()).dependencies).toMatchObject({ primary: 1, additional: 1, taskOwner: 1, total: 3 })
    const stale = await send(userB, [{ collection: 'dealLeads', id: 'lead-used', data: null, baseRev: 1 }])
    expect(stale.applied).toEqual([])
    expect(stale.conflicts[0]).toMatchObject({ id: 'lead-used', deleted: false })
    expect((await (await api(userB, '/')).json()).records.some((r: { id: string }) => r.id === 'lead-used')).toBe(true)
  })

  it('a legacy name on a deal counts as a use of the lead', async () => {
    await send(userA, [
      { ...lead('lead-legacy', { name: 'Old Name' }), baseRev: 0 },
      { collection: 'opportunities', id: 'o-legacy', data: { dealLead: 'old name', primaryLeadId: null, additionalLeadIds: [] }, baseRev: 0 },
    ])
    const res = await api(userA, '/deal-leads/lead-legacy', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect((await res.json()).dependencies.legacyName).toBe(1)
  })

  it('an unused lead deletes, undo restores it, and it does not return on its own', async () => {
    await send(userA, [{ ...lead('lead-free2'), baseRev: 0 }])
    expect((await api(userB, '/deal-leads/lead-free2', { method: 'DELETE' })).status).toBe(200)
    expect((await (await api(userA, '/')).json()).records.some((r: { id: string }) => r.id === 'lead-free2')).toBe(false)
    const delta = await (await api(userA, '/?since=2000-01-01T00:00:00.000Z')).json()
    expect(delta.records.find((r: { id: string }) => r.id === 'lead-free2')).toMatchObject({ deleted: true, data: null })
    const restored = await api(userA, '/deal-leads/lead-free2/restore', { method: 'POST' })
    expect(restored.status).toBe(200)
    expect((await (await api(userB, '/')).json()).records.some((r: { id: string }) => r.id === 'lead-free2')).toBe(true)
    expect((await api(userA, '/deal-leads/lead-free2', { method: 'DELETE' })).status).toBe(200)
    db.prepare(`UPDATE workspace_records SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = 'lead-free2'`).run()
    expect((await api(userA, '/deal-leads/lead-free2/restore', { method: 'POST' })).status).toBe(410)
    const { events } = await (await api(userA, '/audit/dealLeads/lead-free2')).json()
    expect(events.map((e: { action: string }) => e.action)).toEqual(['delete', 'restore', 'delete', 'create'])
  })

  it('a stale screen cannot assign a lead that was just deleted', async () => {
    await send(userA, [{ ...lead('lead-race'), baseRev: 0 }, { collection: 'opportunities', id: 'o-race', data: { primaryLeadId: null, additionalLeadIds: [] }, baseRev: 0 }])
    await api(userA, '/deal-leads/lead-race', { method: 'DELETE' })
    const res = await send(userB, [{ collection: 'opportunities', id: 'o-race', data: { primaryLeadId: 'lead-race', additionalLeadIds: [] }, baseRev: 1 }])
    expect(res.applied).toEqual([])
    expect(res.blocked[0].reason).toMatch(/deleted/)
  })

  it('deleting a lead never touches deals, tasks or documents', async () => {
    const count = () => (db.prepare(`SELECT COUNT(*) AS c FROM workspace_records WHERE collection != 'dealLeads' AND deleted = 0`).get() as { c: number }).c
    const before = count()
    await send(userA, [{ ...lead('lead-gone'), baseRev: 0 }])
    await api(userA, '/deal-leads/lead-gone', { method: 'DELETE' })
    expect(count()).toBe(before)
  })
})

describe('server copies', () => {
  it('makes a readable copy and keeps it off every route for ordinary users', async () => {
    const { runBackup, listBackups } = await import('../services/backup.ts')
    const made = await runBackup()
    expect(made.size).toBeGreaterThan(0)
    expect(listBackups()[0].name).toBe(made.name)
    const Database = (await import('better-sqlite3')).default
    const copy = new Database(path.join(process.env.CRM_BACKUP_DIR!, made.name), { readonly: true })
    expect((copy.prepare(`SELECT COUNT(*) AS c FROM workspace_records`).get() as { c: number }).c).toBeGreaterThan(0)
    copy.close()
    const res = await fetch(`${base}/api/security/backups`, { headers: { authorization: `Bearer ${userB}`, 'x-forwarded-for': ip() } })
    expect(res.status).toBe(403)
  })
})
