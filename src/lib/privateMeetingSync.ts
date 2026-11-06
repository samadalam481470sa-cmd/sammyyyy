/**
 * Keeps this browser's copy of the signed-in person's meetings in step with their private store.
 * The server filters every call by the verified account, so this code can only ever see its owner's rows.
 * Meetings already in this browser are uploaded to the same person's private store the first time.
 */
import { CRM_MEETINGS_CHANGED, loadCrmMeetings, saveCrmMeetings, uploadTranscriptFiles } from '@/lib/crmMeetings'
import { deletePrivateMeeting, isWorkspaceShared, pullPrivateMeetings, pushPrivateMeeting } from '@/lib/workspaceSync'
import type { CrmMeeting } from '@/types/crmMeeting'

interface SyncedRow {
  rev: number
  json: string
  /** The transcript files reached the server, or there are none to send. */
  files: boolean
}
type SyncMap = Record<string, SyncedRow>

const MAP_PREFIX = 'newport_crm_meeting_sync__'

function readMap(owner: string): SyncMap {
  try {
    return JSON.parse(localStorage.getItem(MAP_PREFIX + owner) ?? '{}') as SyncMap
  } catch {
    return {}
  }
}

function writeMap(owner: string, map: SyncMap): void {
  try {
    localStorage.setItem(MAP_PREFIX + owner, JSON.stringify(map))
  } catch {
    // The map is rebuilt from the server on the next full sync.
  }
}

export function clearMeetingSyncMap(owner: string): void {
  try {
    localStorage.removeItem(MAP_PREFIX + owner)
  } catch {
    // ignore
  }
}

/** True when every local change has reached the server, so the local cache is safe to clear. */
export function meetingsFullySynced(owner: string): boolean {
  const map = readMap(owner)
  const rows = loadCrmMeetings(owner)
  return rows.every((row) => map[row.id]?.json === JSON.stringify(row) && map[row.id]?.files) && Object.keys(map).every((id) => rows.some((row) => row.id === id))
}

const writers = new Map<string, Promise<void>>()

/** Runs one sync at a time per person. A call during a sync waits for it, then runs again. */
export function syncPrivateMeetings(owner: string): Promise<void> {
  const previous = writers.get(owner) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => runSync(owner))
  writers.set(owner, next)
  return next
}

async function runSync(owner: string): Promise<void> {
  if (!isWorkspaceShared()) return
  const { records } = await pullPrivateMeetings()
  const map = readMap(owner)
  const remote = new Map(records.filter((row) => !row.deleted && row.data).map((row) => [row.id, row]))
  const local = new Map(loadCrmMeetings(owner).map((row) => [row.id, row]))
  let changedLocally = false

  for (const [id, row] of remote) {
    const synced = map[id]
    const mine = local.get(id)
    const localDirty = mine && synced?.json !== JSON.stringify(mine)
    if (!mine && synced && synced.rev >= row.rev) continue // deleted here, the delete is sent below
    if (localDirty && (!synced || synced.rev === row.rev)) continue // this device has the newer edit
    if (localDirty && mine && String(mine.updatedAt) > String((row.data as unknown as CrmMeeting).updatedAt)) {
      // Edited on two of this person's devices: the later save wins, and it is sent below.
      map[id] = { rev: row.rev, json: synced?.json ?? '', files: synced?.files ?? false }
      continue
    }
    if (!synced || synced.rev !== row.rev || !mine) {
      const data = row.data as unknown as CrmMeeting
      local.set(id, data)
      map[id] = { rev: row.rev, json: JSON.stringify(data), files: true }
      changedLocally = true
    }
  }
  // Removed on another of this person's devices.
  for (const id of Object.keys(map)) {
    if (!remote.has(id) && local.has(id) && map[id].json === JSON.stringify(local.get(id))) {
      local.delete(id)
      delete map[id]
      changedLocally = true
    }
  }
  if (changedLocally) saveCrmMeetings(owner, [...local.values()])

  for (const id of Object.keys(map)) {
    if (local.has(id)) continue
    await deletePrivateMeeting(id)
    delete map[id]
  }
  for (const [id, row] of local) {
    const json = JSON.stringify(row)
    const synced = map[id]
    if (synced?.json === json && synced.files) continue
    let rev = synced?.rev ?? remote.get(id)?.rev ?? 0
    if (synced?.json !== json) {
      const saved = await pushPrivateMeeting(id, row, rev)
      if (!saved.ok) {
        map[id] = { rev: saved.rev, json: synced?.json ?? '', files: synced?.files ?? false }
        continue // the next sync settles it
      }
      rev = saved.rev
    }
    let files = synced?.files ?? false
    if (!files) {
      if (row.transcript) await uploadTranscriptFiles(owner, id)
      files = true
    }
    map[id] = { rev, json, files }
    writeMap(owner, map)
  }
  writeMap(owner, map)
}

export { CRM_MEETINGS_CHANGED }
