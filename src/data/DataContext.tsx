import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ActivityItem, Opportunity, OpportunityUpdate } from '@/types'
import {
  createOpportunity as apiCreateOpportunity,
  fetchOpportunities,
  getStoredSession,
  updateOpportunity,
} from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { microsoftLoginInProgress } from '@/auth/msal'
import { mockOpportunities } from '@/data/mockOpportunities'
import { pullCrmVault, pushCrmVault } from '@/lib/onedriveVault'
import {
  WORKSPACE_STATE_EVENT,
  isWorkspaceShared,
  pullWorkspace,
  pushWorkspaceChanges,
  deleteWorkspaceLead,
  restoreWorkspaceLead,
  uploadWorkspaceFile,
  workspaceApiBase,
  type WorkspaceChange,
  type WorkspaceCollection,
  type WorkspaceRecord,
} from '@/lib/workspaceSync'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import { CRM_MEETINGS_CHANGED, syncPrivateMeetings } from '@/lib/privateMeetingSync'
import { displayValue, fieldLabel, mergeRecord, recordLabel } from '@/lib/recordMerge'
import { compareImport, type ImportOptions, type ImportPreview, type ImportResult } from '@/lib/safeImport'
import { DOCUMENT_TYPES_CHANGED, saveCustomTypes, storedCustomTypes } from '@/lib/documentTypes'
import { RESOURCE_CHANGED, type ResourceChangedDetail } from '@/hooks/useResource'
import { LeadInUseError } from '@/lib/workspaceSync'
import {
  mockContacts,
  mockDocuments,
  mockTasksDb,
  type ContactRecord,
  type DocumentRecord,
  type TaskRecord,
} from '@/data/mockModules'
import { appendDemoChange, loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import {
  buildPortableDatabase,
  bundledSeedSnapshot,
  DATABASE_FILE_ERROR,
  downloadPortableDatabase,
  fetchSeedSnapshot,
  parsePortableDatabase,
  applySchemaMigrations,
  persistMigratedDatabase,
  sameRecordIds,
  SCHEMA_VERSION,
  writeStoredSchemaVersion,
  type PortableDatabase,
  type SeedSnapshot,
} from '@/lib/portableDatabase'
import { registerVaultFlush } from '@/lib/userVault'
import { demoProjectNumber } from '@/lib/demoAliases'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { findCrmUserById, findCrmUserByName, type CrmUser } from '@/lib/crmUsers'
import { nextProjectNumber } from '@/lib/dealId'
import { nowIso, todayDateInput } from '@/lib/calendarDate'
import { isLocalPersistence } from '@/lib/persistenceMode'
import { deleteDocumentBlob, getDocumentBlob, putDocumentBlob } from '@/lib/documentFileStore'
import {
  applyTaskArchiveRules,
  applyTaskStatusTransition,
  migrateTaskRecord,
  restoreTaskFields,
} from '@/lib/taskLifecycle'
import {
  applyNextActionSummary,
  nextActionFieldsTouched,
  preserveManualNextAction,
  syncDrivingTaskFromOpportunityPatch,
  withManualNextActionOverride,
} from '@/lib/nextAction'
import { withLiveAttention } from '@/lib/attention'
import { DEAL_LEADS_RESOURCE, DEFAULT_DEAL_LEADS, leadUsage, migrateOpportunityLeads, migrateTaskOwner, resolveLeadIdByName, type DealLead } from '@/lib/dealLeads'
import { applyStatusChange, initialStatusHistory } from '@/lib/statusHistory'
import { applyDataFixes, applyTaskDataFixes } from '@/lib/dataFixes'
import { mergeSeedRecordsForOwner, readSeedLedger } from '@/lib/seedLedger'
import { runConsistencyAudit } from '@/lib/consistencyAudit'
import {
  documentActivity,
  opportunityCreateActivity,
  opportunityDeleteActivity,
  opportunityUpdateActivity,
  makeActivity,
  taskActivity,
} from '@/lib/activityLog'

interface DataContextValue {
  opportunities: Opportunity[]
  tasks: TaskRecord[]
  documents: DocumentRecord[]
  activity: ActivityItem[]
  users: CrmUser[]
  /** The shared Deal Lead roster, Active and Inactive. */
  dealLeads: DealLead[]
  loading: boolean
  error: string | null
  isLocalPersistence: boolean
  refresh: () => Promise<void>
  saveOpportunity: (id: string, patch: OpportunityUpdate) => Promise<Opportunity>
  createOpportunity: (draft: Partial<Opportunity>) => Promise<Opportunity>
  deleteOpportunity: (id: string) => Promise<void>
  saveTask: (id: string, patch: Partial<TaskRecord>) => Promise<TaskRecord>
  createTask: (draft: Partial<TaskRecord>) => Promise<TaskRecord>
  archiveTask: (id: string) => Promise<TaskRecord>
  /** Back to Open from Task History. Original due date and completion history stay. */
  restoreTask: (id: string) => Promise<TaskRecord>
  deleteTask: (id: string) => Promise<void>
  saveDocument: (id: string, patch: Partial<DocumentRecord>) => Promise<DocumentRecord>
  createDocument: (draft: Partial<DocumentRecord>) => Promise<DocumentRecord>
  deleteDocument: (id: string) => Promise<void>
  downloadDatabase: () => void
  /** Compares a backup file with the current records. Changes nothing. */
  previewImport: (file: Blob) => Promise<{ error: string } | { preview: ImportPreview }>
  /** Adds what was reviewed. Records already saved are only replaced when asked, and never deleted. */
  applyImport: (preview: ImportPreview, options: ImportOptions) => Promise<ImportResult>
  undoLastImport: () => Promise<{ removed: number; kept: number }>
  lastImport: () => LastImport | null
  /** The copy of this browser's data taken before it joined the shared workspace. */
  localBackup: () => Promise<Blob | null>
  /**
   * Waits for the server to confirm pending changes. Throws when it cannot be reached.
   * With `revert`, that collection is put back on screen as it was before the edit when the server
   * cannot be reached, the same way deals and tasks are.
   */
  confirmSaved: (revert?: SavedSnapshot) => Promise<void>
  saveInBatch: <T>(run: () => Promise<T>) => Promise<T>
  sync: SyncStatus
  dismissConflict: (id: string) => void
  /** Removes a lead nothing refers to. Throws LeadInUseError, with counts, when something does. */
  deleteDealLead: (id: string) => Promise<void>
  undoDeleteDealLead: (id: string) => Promise<void>
  /** After a lead is renamed: deals with that primary lead show the new name. */
  syncLeadName: (leadId: string, name: string) => void
  /** A saved change to the roster, for Recent Activity. */
  logLeadActivity: (message: string, lead: Pick<DealLead, 'name'>) => void
}

export interface ConflictNotice {
  id: string
  message: string
}

export interface SyncStatus {
  /** local: no shared server. saving: changes on their way. synced: the server has everything. failed: it does not. */
  state: 'local' | 'connecting' | 'saving' | 'synced' | 'failed'
  lastSyncedAt: string | null
  message: string | null
  conflicts: ConflictNotice[]
}

export interface LastImport {
  batchId: string
  at: string
  fileName: string
  added: { collection: WorkspaceCollection; id: string; rev: number }[]
}

const DataContext = createContext<DataContextValue | null>(null)

const OFFLINE_EDITS_PREFIX = 'newport_crm_offline_edits__'
const LOCAL_BACKUP_DOC = 'pre-sync-local-backup'
const LAST_IMPORT_PREFIX = 'newport_crm_last_import__'

const flagGet = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const flagSet = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: this only affects the backup reminder.
  }
}

const API_BASE = '/api/resources'

/** Someone else saved the same field first: the save did not take, and rolling back would be wrong. */
class SaveConflict extends Error {}

/** A browser-first collection as it was before an edit, so a failed save can be taken back. */
export interface SavedSnapshot {
  resource: 'contacts' | typeof DEAL_LEADS_RESOURCE
  items: readonly { id: string }[]
}

async function resourceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredSession()?.token
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

function decorateOpportunities(list: Opportunity[], tasks: TaskRecord[]): Opportunity[] {
  const withManual = list.map((row) =>
    applyNextActionSummary(
      preserveManualNextAction({
        ...row,
        projectNumber: row.projectNumber ?? demoProjectNumber(row.id),
        outstandingItems: row.outstandingItems ?? [],
        diligenceNotes: row.diligenceNotes ?? '',
      }),
      tasks,
    ),
  )
  return withLiveAttention(withManual, tasks)
}

function loadRoster(owner: string): DealLead[] {
  // The starting leads are used only when this browser has no roster, so a deleted lead stays deleted.
  return loadOwnedCollection<DealLead>(DEAL_LEADS_RESOURCE, owner, DEFAULT_DEAL_LEADS)
}

function snapshotLocalCrm(owner: string, users: CrmUser[]) {
  const loaded = {
    opportunities: loadOwnedCollection<Opportunity>('opportunities', owner, mockOpportunities),
    tasks: loadOwnedCollection<TaskRecord>('tasks', owner, mockTasksDb),
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts),
    documents: loadOwnedCollection<DocumentRecord>('documents', owner, mockDocuments),
    activity: loadOwnedCollection<ActivityItem>('activity', owner, []),
  }
  return presentDatabase(persistMigratedDatabase(owner, loaded), users, loadRoster(owner))
}

function presentDatabase(database: PortableDatabase, users: CrmUser[], roster: readonly DealLead[]) {
  const rawTasks = applyTaskArchiveRules(applyTaskDataFixes(database.tasks).map((row) => migrateTaskOwner(migrateTaskRecord(row, users), roster)))
  return {
    tasks: rawTasks.tasks,
    opportunities: decorateOpportunities(applyDataFixes(database.opportunities).map((row) => migrateOpportunityLeads(row, roster)), rawTasks.tasks),
    documents: database.documents,
    activity: database.activity,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const owner = sessionOwnerKey(user)
  // Task owners come from the Deal Lead roster, by stable id. Inactive leads are in this list so old
  // assignments keep their name; pickers offer Active leads only.
  const [roster, setRoster] = useState<DealLead[]>(() => loadRoster(owner))
  const users = useMemo<CrmUser[]>(() => roster.map((lead) => ({ id: lead.id, name: lead.name })), [roster])
  useEffect(() => setRoster(loadRoster(owner)), [owner])
  const usersRef = useRef(users)
  usersRef.current = users
  const local = isLocalPersistence()
  const seeded =
    local && isAuthenticated
      ? snapshotLocalCrm(owner, users)
      : {
          opportunities: [] as Opportunity[],
          tasks: [] as TaskRecord[],
          documents: [] as DocumentRecord[],
          activity: [] as ActivityItem[],
        }

  const [opportunities, setOpportunities] = useState<Opportunity[]>(seeded.opportunities)
  const [tasks, setTasks] = useState<TaskRecord[]>(seeded.tasks)
  const [documents, setDocuments] = useState<DocumentRecord[]>(seeded.documents)
  const [activity, setActivity] = useState<ActivityItem[]>(seeded.activity)
  const [loading, setLoading] = useState(!local)
  const [error, setError] = useState<string | null>(null)

  const oppsRef = useRef<Opportunity[]>(seeded.opportunities)
  const tasksRef = useRef<TaskRecord[]>(seeded.tasks)
  const docsRef = useRef<DocumentRecord[]>(seeded.documents)
  const activityRef = useRef<ActivityItem[]>(seeded.activity)

  const persistOpps = (next: Opportunity[]) => {
    oppsRef.current = next
    saveOwnedCollection('opportunities', owner, next)
    setOpportunities(next)
    pushCloud()
  }
  const persistTasks = (next: TaskRecord[]) => {
    tasksRef.current = next
    saveOwnedCollection('tasks', owner, next)
    setTasks(next)
    pushCloud()
  }
  const persistDocs = (next: DocumentRecord[]) => {
    docsRef.current = next
    saveOwnedCollection('documents', owner, next)
    setDocuments(next)
    pushCloud()
  }
  const persistActivity = (next: ActivityItem[]) => {
    activityRef.current = next
    saveOwnedCollection('activity', owner, next)
    setActivity(next)
    pushCloud()
  }

  const changeMeta = () => ({
    actorName: user?.name || 'Newport user',
    ownerKey: owner,
    apiKeySlot: user?.apiKeySlot ?? null,
    authMethod: user?.authMethod,
  })

  const logChange = (
    resourceType: string,
    resourceId: string,
    changeType: string,
    changedFields: string[],
  ) => {
    appendDemoChange({
      resourceType,
      resourceId,
      changeType,
      changedFields,
      createdAt: nowIso(),
      ...changeMeta(),
    })
  }

  const pushActivity = (item: ActivityItem | null) => {
    if (!item) return
    persistActivity([item, ...activityRef.current].slice(0, 1000))
  }

  const cloudTimer = useRef<number | null>(null)
  const allowCloudPush = useRef(false)
  const cloudEpoch = useRef(0)
  const seedAddedOnPull = useRef(false)
  const fetchedSeedRef = useRef<SeedSnapshot | null>(null)
  // ── Shared workspace (server) sync ────────────────────────────────────────
  const sharedRef = useRef(false)
  const syncedRef = useRef<Map<string, string>>(new Map())
  const revRef = useRef<Map<string, number>>(new Map())
  const sinceRef = useRef<string | null>(null)
  const sharedTimer = useRef<number | null>(null)
  const pushChain = useRef<Promise<unknown>>(Promise.resolve())
  const serverConfigured = useRef(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const [syncState, setSyncState] = useState<Pick<SyncStatus, 'state' | 'lastSyncedAt' | 'message'>>({ state: 'local', lastSyncedAt: null, message: null })
  const [conflicts, setConflicts] = useState<ConflictNotice[]>([])
  const notifyConflict = (message: string) => setConflicts((prev) => [...prev.slice(-4), { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, message }])

  // Meeting history is user-private: it is never part of the shared snapshot.
  const workspaceSnapshot = (): Partial<Record<WorkspaceCollection, { id: string }[]>> => ({
    opportunities: oppsRef.current,
    tasks: tasksRef.current,
    documents: docsRef.current,
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts),
    dealLeads: loadRoster(owner),
    activity: activityRef.current,
    documentTypes: storedCustomTypes().map((name) => ({ id: name.toLowerCase(), name })),
  })

  const snapshotKeys = () => {
    const map = new Map<string, string>()
    for (const [collection, rows] of Object.entries(workspaceSnapshot())) {
      for (const row of rows ?? []) if (row?.id) map.set(`${collection}/${row.id}`, JSON.stringify(row))
    }
    return map
  }

  const parseRow = (json: string | undefined) => (json ? (JSON.parse(json) as Record<string, unknown>) : null)

  /** Someone saved this record first. Keep their work, merge what is safe, and say what was not applied. */
  const settleConflict = (record: WorkspaceRecord, base: string | undefined, mine: string | undefined): string | null => {
    const key = `${record.collection}/${record.id}`
    const result = mergeRecord(parseRow(base), parseRow(mine), record.deleted ? null : record.data)
    const label = recordLabel(parseRow(mine) ?? record.data, record.id)
    const who = record.updatedBy || 'Another person'
    let notice: string | null = null
    if (result.deleteConflict === 'theirs-deleted') notice = `${who} deleted “${label}”. Your edits to it were not saved.`
    else if (result.deleteConflict === 'mine-deleted') notice = `${who} changed “${label}”, so it was not deleted.`
    else if (result.conflicts.length) {
      const list = result.conflicts.map((row) => `${fieldLabel(row.field)} (saved: ${displayValue(row.theirs)}, yours: ${displayValue(row.mine)})`).join('; ')
      notice = `${who} changed “${label}” while you were editing. Their value was kept for ${list}. Your other changes were saved.`
    }
    if (notice) notifyConflict(notice)
    revRef.current.set(key, record.rev ?? 0)
    if (result.merged) applyShared([{ ...record, deleted: false, data: result.merged }], false, true)
    else applyShared([{ ...record, deleted: true, data: null }], false, true)
    if (result.hasMine) syncedRef.current.set(key, JSON.stringify(record.data))
    return notice
  }

  /** One push at a time. Sends only records that changed, each with the revision it was based on. */
  const runPush = async (): Promise<{ key: string; notice: string }[]> => {
    const current = snapshotKeys()
    const changes: WorkspaceChange[] = []
    const sent = new Map<string, string | null>()
    for (const [key, json] of current) {
      if (syncedRef.current.get(key) === json) continue
      const [collection, ...rest] = key.split('/')
      const known = revRef.current.get(key)
      changes.push({ collection: collection as WorkspaceCollection, id: rest.join('/'), data: JSON.parse(json), baseRev: known ?? (syncedRef.current.has(key) ? undefined : 0) })
      sent.set(key, json)
    }
    for (const key of syncedRef.current.keys()) {
      // The feed is trimmed on screen. Older entries stay on the server and in the audit trail.
      if (current.has(key) || key.startsWith('activity/')) continue
      const [collection, ...rest] = key.split('/')
      changes.push({ collection: collection as WorkspaceCollection, id: rest.join('/'), data: null, baseRev: revRef.current.get(key) })
      sent.set(key, null)
    }
    if (!changes.length) {
      setSyncState((prev) => ({ state: 'synced', lastSyncedAt: prev.lastSyncedAt ?? new Date().toISOString(), message: null }))
      return []
    }
    setSyncState((prev) => ({ ...prev, state: 'saving', message: null }))
    const result = await pushWorkspaceChanges(changes)
    const stamp = new Date().toISOString()
    const before = new Map(syncedRef.current)
    if (!result.versioned) {
      for (const [key, json] of sent) {
        if (json === null) syncedRef.current.delete(key)
        else syncedRef.current.set(key, json)
      }
    }
    for (const row of result.applied) {
      const key = `${row.collection}/${row.id}`
      revRef.current.set(key, row.rev)
      const json = sent.get(key)
      if (json === null || json === undefined) syncedRef.current.delete(key)
      else syncedRef.current.set(key, json)
    }
    const notices: { key: string; notice: string }[] = []
    for (const record of result.conflicts) {
      const key = `${record.collection}/${record.id}`
      const notice = settleConflict(record, before.get(key), current.get(key))
      if (notice) notices.push({ key, notice })
    }
    for (const row of result.blocked) {
      const key = `${row.collection}/${row.id}`
      notifyConflict(row.reason)
      notices.push({ key, notice: row.reason })
    }
    setError(null)
    flagSet(OFFLINE_EDITS_PREFIX + owner, null)
    setSyncState({ state: 'synced', lastSyncedAt: stamp, message: null })
    channelRef.current?.postMessage('changed')
    // A merge can leave this person's safe changes still to send.
    if (result.conflicts.length) schedulePush(50)
    return notices
  }

  const queuePush = () => {
    const run = pushChain.current.catch(() => undefined).then(runPush)
    pushChain.current = run
    return run
  }

  const schedulePush = (delay: number) => {
    if (sharedTimer.current) window.clearTimeout(sharedTimer.current)
    sharedTimer.current = window.setTimeout(() => void pushShared(), delay)
  }

  /** Background sends: a failure is shown, retried, and flagged so a later full pull keeps a copy. */
  const pushShared = async () => {
    if (!sharedRef.current) return
    try {
      await queuePush()
    } catch (err) {
      flagSet(OFFLINE_EDITS_PREFIX + owner, '1')
      const message = err instanceof Error ? `Not saved to the server yet: ${err.message} It will retry.` : 'Not saved to the server yet. It will retry.'
      setError(message)
      setSyncState((prev) => ({ ...prev, state: 'failed', message }))
      schedulePush(8000)
    }
  }

  /** Apply records from the server. A full pull replaces local data; a partial pull merges. */
  const applyShared = (records: WorkspaceRecord[], full: boolean, force = false) => {
    const base = workspaceSnapshot()
    const currentKeys = snapshotKeys()
    // Only a real unsent edit counts. Presenting the data below can reorder or fill fields on any record.
    const unsent = new Set([...currentKeys.keys(), ...syncedRef.current.keys()].filter((key) => currentKeys.get(key) !== syncedRef.current.get(key)))
    const touched = new Set<string>()
    const collections = {} as Record<WorkspaceCollection, Map<string, unknown>>
    for (const name of Object.keys(base) as WorkspaceCollection[]) {
      collections[name] = new Map(full ? [] : (base[name] ?? []).map((row) => [row.id, row]))
    }
    for (const record of records) {
      const target = collections[record.collection]
      if (!target) continue
      const key = `${record.collection}/${record.id}`
      // This device has an unsent edit: leave it. Sending it brings the conflict check into play.
      if (!full && !force && unsent.has(key)) continue
      if (typeof record.rev === 'number') revRef.current.set(key, record.rev)
      touched.add(key)
      if (record.deleted || !record.data) target.delete(record.id)
      else target.set(record.id, record.data)
    }
    if (!full && !touched.size) return
    const list = <T,>(name: WorkspaceCollection) => [...collections[name].values()] as T[]
    const contacts = list<ContactRecord>('contacts')
    saveOwnedCollection('contacts', owner, contacts)
    const detail: ResourceChangedDetail = { resource: 'contacts', owner, source: -1, items: contacts }
    window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
    // The roster is what the server says. Nothing adds a lead back here.
    const dealLeads = list<DealLead>('dealLeads')
    saveOwnedCollection(DEAL_LEADS_RESOURCE, owner, dealLeads)
    setRoster(dealLeads)
    const leadDetail: ResourceChangedDetail = { resource: DEAL_LEADS_RESOURCE, owner, source: -1, items: dealLeads }
    window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail: leadDetail }))
    saveCustomTypes(list<{ name: string }>('documentTypes').map((row) => row.name).filter(Boolean))
    const database = buildPortableDatabase(
      {
        opportunities: list<Opportunity>('opportunities'),
        tasks: list<TaskRecord>('tasks'),
        documents: list<DocumentRecord>('documents'),
        activity: list<ActivityItem>('activity').sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
        contacts,
      },
      new Date().toISOString(),
    )
    applyingRemote.current = true
    try {
      writeDatabaseRef.current(database, false)
    } finally {
      applyingRemote.current = false
    }
    // What is on screen now matches the server; record it so it is not pushed back.
    const now = snapshotKeys()
    if (full) syncedRef.current = now
    else {
      for (const key of new Set([...now.keys(), ...syncedRef.current.keys()])) {
        if (unsent.has(key) && !touched.has(key)) continue
        const json = now.get(key)
        if (json) syncedRef.current.set(key, json)
        else syncedRef.current.delete(key)
      }
    }
    // Repair known starter-data problems on the shared copy too; the change is pushed to the server.
    const repaired = applyDataFixes(oppsRef.current)
    if (repaired !== oppsRef.current) persistOpps(decorateOpportunities(repaired, tasksRef.current))
  }
  const applyingRemote = useRef(false)

  const pushCloud = () => {
    if (sharedRef.current) {
      if (applyingRemote.current) return
      schedulePush(600)
      return
    }
    // Disconnected from a configured server: this edit is on this device only until a copy is reviewed.
    if (serverConfigured.current) {
      if (!applyingRemote.current) flagSet(OFFLINE_EDITS_PREFIX + owner, '1')
      return
    }
    if (!allowCloudPush.current || user?.authMethod !== 'microsoft') return
    if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
    cloudTimer.current = window.setTimeout(() => {
      const contacts = loadOwnedCollection('contacts', owner, mockContacts)
      void pushCrmVault({
        updatedAt: new Date().toISOString(),
        opportunities: oppsRef.current,
        tasks: tasksRef.current,
        documents: docsRef.current.map(({ ...doc }) => doc),
        contacts,
        activity: activityRef.current,
      })
    }, 1200)
  }

  const writeDatabaseRef = useRef<(database: PortableDatabase, sync: boolean) => void>(() => undefined)

  const syncOpportunitySummaries = (opps: Opportunity[], taskList: TaskRecord[]) =>
    decorateOpportunities(opps, taskList)

  /**
   * One copy per browser of the data it held before joining the shared workspace, and a new copy
   * whenever edits were made while disconnected. A full pull can then never lose them.
   */
  const keepLocalBackup = async () => {
    const flagKey = `${OFFLINE_EDITS_PREFIX}${owner}`
    const hadOwnData = readSeedLedger(owner) !== null
    const existing = await getDocumentBlob(owner, LOCAL_BACKUP_DOC).catch(() => null)
    if (!flagGet(flagKey) && (existing || !hadOwnData)) return
    const database = buildPortableDatabase(
      {
        opportunities: oppsRef.current,
        tasks: tasksRef.current,
        documents: docsRef.current,
        activity: activityRef.current,
        contacts: loadOwnedCollection<ContactRecord>('contacts', owner, []),
        dealLeads: loadRoster(owner),
      },
      new Date().toISOString(),
    )
    const copy = new File([JSON.stringify(database)], `newport-crm-this-device-${todayDateInput()}.json`, { type: 'application/json' })
    await putDocumentBlob(owner, LOCAL_BACKUP_DOC, copy).catch(() => undefined)
    flagSet(flagKey, null)
  }

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      sharedRef.current = false
      syncedRef.current = new Map()
      revRef.current = new Map()
      sinceRef.current = null
      setConflicts([])
      setSyncState({ state: 'local', lastSyncedAt: null, message: null })
      oppsRef.current = []
      tasksRef.current = []
      docsRef.current = []
      activityRef.current = []
      setOpportunities([])
      setTasks([])
      setDocuments([])
      setActivity([])
      return
    }
    setError(null)
    const loadLocal = () => {
      const snap = snapshotLocalCrm(owner, usersRef.current)
      applyingRemote.current = true
      try {
        persistTasks(snap.tasks)
        persistOpps(snap.opportunities)
        persistDocs(snap.documents)
        persistActivity(snap.activity)
      } finally {
        applyingRemote.current = false
      }
    }
    if (isLocalPersistence()) {
      loadLocal()
      setLoading(false)
      if (isWorkspaceShared() || (await workspaceApiBase())) {
        serverConfigured.current = true
        // Shared company workspace: the server is the source of truth for every approved user.
        setSyncState((prev) => ({ ...prev, state: 'connecting', message: null }))
        try {
          // Before the server's records replace this browser's copy, keep that copy to review later.
          await keepLocalBackup()
          const pulled = await pullWorkspace()
          sharedRef.current = true
          sinceRef.current = pulled.serverTime
          revRef.current = new Map()
          if (pulled.empty) {
            // First person on a new server: their records become the shared starting data.
            syncedRef.current = new Map()
            void pushShared()
          } else {
            applyShared(pulled.records, true)
            setSyncState({ state: 'synced', lastSyncedAt: pulled.serverTime, message: null })
          }
          setError(null)
        } catch (err) {
          sharedRef.current = false
          const message = err instanceof Error ? `Shared workspace unavailable: ${err.message} Changes stay on this device until it reconnects.` : 'Shared workspace unavailable.'
          setError(message)
          setSyncState((prev) => ({ ...prev, state: 'failed', message }))
        }
        return
      }
      if (user?.authMethod === 'microsoft') {
        const epoch = cloudEpoch.current
        void pullCrmVault()
          .then((vault) => {
            if (epoch !== cloudEpoch.current || !vault) return
            if (!(vault.updatedAt > (activityRef.current[0]?.timestamp ?? ''))) return
            allowCloudPush.current = false
            const contacts = Array.isArray(vault.contacts)
              ? (vault.contacts as ContactRecord[])
              : loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts)
            const merged = mergeSeedRecordsForOwner(
              buildPortableDatabase(
                {
                  opportunities: vault.opportunities as Opportunity[],
                  tasks: vault.tasks as TaskRecord[],
                  documents: vault.documents as DocumentRecord[],
                  activity: vault.activity as ActivityItem[],
                  contacts,
                },
                vault.updatedAt,
              ),
              bundledSeedSnapshot(),
              owner,
            )
            seedAddedOnPull.current = !(
              sameRecordIds(merged.opportunities, vault.opportunities as { id: string }[]) &&
              sameRecordIds(merged.tasks, vault.tasks as { id: string }[]) &&
              sameRecordIds(merged.contacts, contacts) &&
              sameRecordIds(merged.documents, vault.documents as { id: string }[]) &&
              sameRecordIds(merged.activity, vault.activity as { id: string }[])
            )
            writeDatabaseRef.current(merged, false)
          })
          .finally(() => {
            if (epoch !== cloudEpoch.current) return
            allowCloudPush.current = true
            if (!seedAddedOnPull.current) return
            seedAddedOnPull.current = false
            pushCloud()
          })
      }
      return
    }
    setLoading(true)
    try {
      const [data, apiTasks, apiDocs] = await Promise.all([
        fetchOpportunities(),
        resourceRequest<TaskRecord[]>('/tasks').catch(() =>
          loadOwnedCollection('tasks', owner, mockTasksDb),
        ),
        resourceRequest<DocumentRecord[]>('/documents').catch(() =>
          loadOwnedCollection('documents', owner, mockDocuments),
        ),
      ])
      const rawTasks = applyTaskArchiveRules(apiTasks.map((row) => migrateTaskRecord(row, usersRef.current)))
      persistTasks(rawTasks.tasks)
      persistOpps(syncOpportunitySummaries(data, rawTasks.tasks))
      persistDocs(apiDocs)
      persistActivity(loadOwnedCollection<ActivityItem>('activity', owner, []))
    } catch (err) {
      loadLocal()
      setError(err instanceof Error ? err.message : 'Failed to load CRM records')
    } finally {
      setLoading(false)
    }
    // The roster changing must not start a new full pull, so people are read from usersRef.
  }, [isAuthenticated, owner, user])

  useEffect(() => {
    writeDatabaseRef.current = (database, sync) => {
      if (sync) {
        cloudEpoch.current += 1
        allowCloudPush.current = true
      }
      saveOwnedCollection('contacts', owner, database.contacts)
      writeStoredSchemaVersion(owner, SCHEMA_VERSION)
      if (database.dealLeads) {
        saveOwnedCollection(DEAL_LEADS_RESOURCE, owner, database.dealLeads)
        setRoster(database.dealLeads)
        const detail: ResourceChangedDetail = { resource: DEAL_LEADS_RESOURCE, owner, source: -1, items: database.dealLeads }
        window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
      }
      const presented = presentDatabase(database, users, loadRoster(owner))
      persistTasks(presented.tasks)
      persistOpps(presented.opportunities)
      persistDocs(presented.documents)
      persistActivity(presented.activity)
    }
  })

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Development-only consistency check: window.__newportAudit() prints the page-level counts.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __newportAudit?: () => unknown }
    w.__newportAudit = () => runConsistencyAudit(oppsRef.current, tasksRef.current)
    return () => {
      delete w.__newportAudit
    }
  }, [])

  // Other people's changes arrive every 10 seconds (and right away when the window regains focus).
  useEffect(() => {
    if (!isAuthenticated) return
    let running = false
    const poll = async () => {
      if (!sharedRef.current || running) return
      running = true
      try {
        const pulled = await pullWorkspace(sinceRef.current)
        sinceRef.current = pulled.serverTime
        applyShared(pulled.records, false)
        setSyncState((prev) => (prev.state === 'failed' || prev.state === 'connecting' ? { state: 'synced', lastSyncedAt: pulled.serverTime, message: null } : { ...prev, lastSyncedAt: pulled.serverTime }))
      } catch {
        // offline or server busy: the next poll retries
        setSyncState((prev) => (prev.state === 'saving' ? prev : { ...prev, state: 'failed', message: 'The Newport server cannot be reached. Showing the last records received.' }))
      } finally {
        running = false
      }
    }
    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<ResourceChangedDetail>).detail
      if (detail?.resource === DEAL_LEADS_RESOURCE && detail.owner === owner) setRoster(detail.items as DealLead[])
      if ((detail?.resource === 'contacts' || detail?.resource === DEAL_LEADS_RESOURCE) && detail.source !== -1) pushCloud()
    }
    const onTypes = () => pushCloud()
    const onState = () => {
      if (!isWorkspaceShared()) return
      if (!sharedRef.current) void refresh()
    }
    // A hidden tab checks less often. Other tabs of this browser update at once through the channel.
    let ticks = 0
    const timer = window.setInterval(() => {
      ticks += 1
      if (document.visibilityState === 'hidden' && ticks % 6 !== 0) return
      void poll()
    }, 10_000)
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('newport-crm-workspace')
    channelRef.current = channel
    if (channel) channel.onmessage = () => void poll()
    const onOnline = () => {
      void poll()
      void pushShared()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', poll)
    window.addEventListener(RESOURCE_CHANGED, onLocalChange)
    window.addEventListener(DOCUMENT_TYPES_CHANGED, onTypes)
    window.addEventListener(WORKSPACE_STATE_EVENT, onState)
    return () => {
      window.clearInterval(timer)
      channel?.close()
      channelRef.current = null
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', poll)
      window.removeEventListener(RESOURCE_CHANGED, onLocalChange)
      window.removeEventListener(DOCUMENT_TYPES_CHANGED, onTypes)
      window.removeEventListener(WORKSPACE_STATE_EVENT, onState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, owner])

  // The signed-in person's own meetings follow them to their other devices.
  const meetingOwner = calendarOwnerKey(user)
  useEffect(() => {
    if (!isAuthenticated) return
    let timer = 0
    const run = () => void syncPrivateMeetings(meetingOwner).catch(() => undefined)
    const soon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 400)
    }
    run()
    const interval = window.setInterval(run, 30_000)
    window.addEventListener(CRM_MEETINGS_CHANGED, soon)
    window.addEventListener(WORKSPACE_STATE_EVENT, soon)
    window.addEventListener('focus', soon)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      window.removeEventListener(CRM_MEETINGS_CHANGED, soon)
      window.removeEventListener(WORKSPACE_STATE_EVENT, soon)
      window.removeEventListener('focus', soon)
    }
  }, [isAuthenticated, meetingOwner])

  useEffect(() => {
    if (!isAuthenticated) return
    return registerVaultFlush(() => {
      saveOwnedCollection('opportunities', owner, oppsRef.current)
      saveOwnedCollection('tasks', owner, tasksRef.current)
      saveOwnedCollection('documents', owner, docsRef.current)
      saveOwnedCollection('activity', owner, activityRef.current)
    })
  }, [isAuthenticated, owner])

  useEffect(() => {
    if (!local || !isAuthenticated) return
    let cancelled = false
    let timer = 0
    const deadline = Date.now() + 12000
    const run = () => {
      if (cancelled) return
      const waitingForLogin = microsoftLoginInProgress()
      const waitingForVault = user?.authMethod === 'microsoft' && !allowCloudPush.current
      if ((waitingForLogin || waitingForVault) && Date.now() < deadline) {
        timer = window.setTimeout(run, waitingForLogin ? 400 : 200)
        return
      }
      if (waitingForLogin) return
      void Promise.all([fetchSeedSnapshot(document.baseURI), workspaceApiBase()]).then(([seed, server]) => {
        if (cancelled || !seed || microsoftLoginInProgress()) return
        // With a shared server, starter records are never merged in: they could bring back what the team deleted.
        if (server || sharedRef.current || isWorkspaceShared()) return
        fetchedSeedRef.current = seed
        const contacts = loadOwnedCollection<ContactRecord>('contacts', owner, [])
        const current = buildPortableDatabase(
          {
            opportunities: oppsRef.current,
            tasks: tasksRef.current,
            documents: docsRef.current,
            activity: activityRef.current,
            contacts,
          },
          new Date().toISOString(),
        )
        const merged = mergeSeedRecordsForOwner(current, seed, owner)
        const unchanged =
          sameRecordIds(merged.opportunities, current.opportunities) &&
          sameRecordIds(merged.tasks, current.tasks) &&
          sameRecordIds(merged.contacts, current.contacts) &&
          sameRecordIds(merged.documents, current.documents) &&
          sameRecordIds(merged.activity, current.activity)
        if (unchanged) return
        writeDatabaseRef.current(merged, true)
      })
    }
    run()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [local, isAuthenticated, owner, user])

  const saveOpportunity = useCallback(
    async (id: string, patch: OpportunityUpdate) => {
      const existing = oppsRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Opportunity not found')
      let taskList = tasksRef.current
      let createdFollowUp: TaskRecord | null = null
      if (nextActionFieldsTouched(patch)) {
        const synced = syncDrivingTaskFromOpportunityPatch(existing, taskList, patch)
        taskList = synced.tasks
        if (synced.drivingId) persistTasks(taskList)
        else if (patch.nextAction?.trim()) {
          // No open task drives this deal yet: the typed next action becomes a real linked task,
          // because alerts and the displayed next action read linked tasks only.
          const stamp = nowIso()
          const ownerRow = findCrmUserByName(existing.dealLead, users)
          createdFollowUp = {
            id: `task_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            priority: patch.priority ?? existing.priority ?? 'B',
            action: patch.nextAction.trim(),
            opportunityId: existing.id,
            projectName: patch.projectName ?? existing.projectName,
            owner: ownerRow?.name ?? existing.dealLead ?? '',
            ownerId: ownerRow?.id ?? null,
            dueDate: patch.nextActionDate ?? null,
            initialDueDate: patch.nextActionDate ?? null,
            dueDateHistory: [],
            status: 'Open',
            notes: '',
            completedAt: null,
            archivedAt: null,
            deletedAt: null,
            createdAt: stamp,
            updatedAt: stamp,
          }
          taskList = [createdFollowUp, ...taskList]
          persistTasks(taskList)
        }
      }
      const stamp = nowIso()
      // Completed = legally closed: the stage always becomes Closing with it.
      const statusPatch0 = patch.status === 'Completed' && existing.status !== 'Completed' ? { ...patch, stage: 'Closing' as const } : patch
      // A name written without an id (for example an Excel autofill) resolves against the roster, never invents a lead.
      const statusPatch = statusPatch0.dealLead !== undefined && statusPatch0.primaryLeadId === undefined
        ? { ...statusPatch0, primaryLeadId: resolveLeadIdByName(statusPatch0.dealLead, loadRoster(owner)) }
        : statusPatch0
      const { closedAt: requestedClosedAt, ...restPatch } = statusPatch
      // A corrected Created date keeps the original insert time beside it, once.
      const createdFix: OpportunityUpdate =
        patch.createdAt !== undefined && patch.createdAt !== existing.createdAt && !existing.recordCreatedAt && existing.createdAt
          ? { recordCreatedAt: existing.createdAt }
          : {}
      const nextPatch: OpportunityUpdate = {
        ...withManualNextActionOverride(restPatch),
        ...createdFix,
        ...applyStatusChange(existing, patch.status, stamp, requestedClosedAt ?? null, {
          nwp: patch.nwp ?? existing.nwp,
          pfEbitda: patch.pfEbitda ?? existing.pfEbitda,
          netRevenue: patch.netRevenue ?? existing.netRevenue,
        }),
        lastActivityDate: stamp,
      }
      const mergedBase = { ...existing, ...nextPatch, updatedAt: stamp }
      const merged = decorateOpportunities([mergedBase], taskList)[0]
      // Links are by ID; copied project labels on linked records follow a rename right away.
      const renamed = patch.projectName !== undefined && patch.projectName !== existing.projectName ? patch.projectName : null
      if (renamed != null) {
        taskList = taskList.map((row) => (row.opportunityId === id ? { ...row, projectName: renamed } : row))
        persistTasks(taskList)
        persistDocs(docsRef.current.map((row) => (row.opportunityId === id ? { ...row, projectName: renamed } : row)))
        const contacts = loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts)
        if (contacts.some((row) => row.opportunityId === id)) {
          const nextContacts = contacts.map((row) => (row.opportunityId === id ? { ...row, projectName: renamed } : row))
          saveOwnedCollection('contacts', owner, nextContacts)
          const detail: ResourceChangedDetail = { resource: 'contacts', owner, source: -1, items: nextContacts }
          window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
        }
      }
      if (isLocalPersistence()) {
        persistOpps(oppsRef.current.map((row) => (row.id === id ? merged : row)))
        logChange('opportunity', id, 'update', Object.keys(patch))
        pushActivity(opportunityUpdateActivity(user?.name ?? null, existing, patch))
        if (createdFollowUp) pushActivity(taskActivity(user?.name ?? null, createdFollowUp, 'created'))
        return merged
      }
      const updated = await updateOpportunity(id, nextPatch)
      const decorated = decorateOpportunities([{ ...existing, ...updated }], taskList)[0]
      persistOpps(oppsRef.current.map((row) => (row.id === id ? decorated : row)))
      pushActivity(opportunityUpdateActivity(user?.name ?? null, existing, patch))
      return decorated
    },
    [owner, user, users],
  )

  const createOpportunity = useCallback(
    async (draft: Partial<Opportunity>) => {
      const projectName = draft.projectName?.trim()
      const entityName = draft.entityName?.trim()
      if (!projectName || !entityName) {
        throw new Error('Project name and entity are required')
      }
      const projectNumber = nextProjectNumber(oppsRef.current)
      if (isLocalPersistence()) {
        const id = `opp_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const createdBase: Opportunity = {
          id,
          projectNumber,
          projectName,
          entityName,
          type: draft.type ?? 'Platform Acquisition',
          status: draft.status ?? 'Pending',
          stage: draft.stage ?? 'Target Identified',
          dealLead: draft.dealLead ?? '',
          primaryLeadId: draft.primaryLeadId ?? resolveLeadIdByName(draft.dealLead, loadRoster(owner)),
          additionalLeadIds: draft.additionalLeadIds ?? [],
          sourceType: draft.sourceType ?? 'Other',
          sourceName: draft.sourceName ?? '',
          specialty: draft.specialty ?? '',
          geography: draft.geography ?? '',
          nwp: draft.nwp ?? 0,
          netRevenue: draft.netRevenue ?? 0,
          pfEbitda: draft.pfEbitda ?? 0,
          nextAction: draft.nextAction ?? null,
          nextActionDate: draft.nextActionDate ?? null,
          priority: draft.priority ?? 'B',
          nextActionManual: draft.nextAction ?? null,
          nextActionDateManual: draft.nextActionDate ?? null,
          priorityManual: draft.priority ?? 'B',
          nextActionTaskId: null,
          lastActivityDate: nowIso(),
          needsAttention: false,
          attentionReasons: [],
          outstandingItems: draft.outstandingItems ?? [],
          diligenceNotes: draft.diligenceNotes ?? '',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          ...initialStatusHistory(draft.status ?? 'Pending', nowIso(), draft.closedAt ?? null),
          ...(draft.status === 'Completed' ? { stage: 'Closing' as const } : {}),
        }
        // A next action typed on the form becomes a real linked task (Next Action reads tasks only).
        let followUp: TaskRecord | null = null
        if (draft.nextAction?.trim()) {
          const leadRow = findCrmUserByName(createdBase.dealLead, users)
          const stamp = nowIso()
          followUp = {
            id: `task_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            priority: createdBase.priority,
            action: draft.nextAction.trim(),
            opportunityId: id,
            projectName,
            owner: leadRow?.name ?? createdBase.dealLead ?? '',
            ownerId: leadRow?.id ?? null,
            dueDate: draft.nextActionDate ?? null,
            initialDueDate: draft.nextActionDate ?? null,
            dueDateHistory: [],
            status: 'Open',
            notes: '',
            completedAt: null,
            archivedAt: null,
            deletedAt: null,
            createdAt: stamp,
            updatedAt: stamp,
          }
          persistTasks([followUp, ...tasksRef.current])
        }
        const created = decorateOpportunities([createdBase], tasksRef.current)[0]
        persistOpps([...oppsRef.current, created])
        logChange('opportunity', created.id, 'create', Object.keys(draft))
        pushActivity(opportunityCreateActivity(user?.name ?? null, created))
        if (followUp) pushActivity(taskActivity(user?.name ?? null, followUp, 'created'))
        return created
      }
      const created = await apiCreateOpportunity({
        ...draft,
        projectName,
        entityName,
        projectNumber,
      } as Partial<Opportunity>)
      const decorated = decorateOpportunities(
        [
          {
            ...created,
            projectNumber: created.projectNumber ?? projectNumber,
            createdAt: created.createdAt ?? nowIso(),
            ...(created.statusHistory?.length ? {} : initialStatusHistory(created.status, created.createdAt ?? nowIso())),
            nextActionManual: created.nextAction ?? null,
            nextActionDateManual: created.nextActionDate ?? null,
            priorityManual: created.priority,
          },
        ],
        tasksRef.current,
      )[0]
      persistOpps([...oppsRef.current, decorated])
      pushActivity(opportunityCreateActivity(user?.name ?? null, decorated))
      return decorated
    },
    [owner, user, users],
  )

  const deleteOpportunity = useCallback(
    async (id: string) => {
      const existing = oppsRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Opportunity not found')
      if (!isLocalPersistence()) {
        await resourceRequest(`/opportunities/${id}`, { method: 'DELETE' }).catch(() => undefined)
      }
      persistTasks(
        tasksRef.current.map((row) =>
          row.opportunityId === id ? { ...row, opportunityId: null, updatedAt: nowIso() } : row,
        ),
      )
      const removedDocs = docsRef.current.filter((row) => row.opportunityId === id)
      persistDocs(docsRef.current.filter((row) => row.opportunityId !== id))
      persistOpps(oppsRef.current.filter((row) => row.id !== id))
      for (const doc of removedDocs) {
        void deleteDocumentBlob(owner, doc.id).catch(() => undefined)
      }
      logChange('opportunity', id, 'delete', ['id'])
      pushActivity(opportunityDeleteActivity(user?.name ?? null, existing))
    },
    [owner, user],
  )

  const touchLinkedOpportunity = (opportunityId: string | null) => {
    if (!opportunityId) return
    const current = oppsRef.current.find((row) => row.id === opportunityId)
    if (!current) return
    const next = decorateOpportunities(
      oppsRef.current.map((row) =>
        row.id === opportunityId ? { ...row, lastActivityDate: nowIso() } : row,
      ),
      tasksRef.current,
    )
    persistOpps(next)
  }

  const saveTask = useCallback(
    async (id: string, patch: Partial<TaskRecord>) => {
      const existing = tasksRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Task not found')
      let merged: TaskRecord = { ...existing, ...patch, updatedAt: nowIso() }
      if (patch.dueDate !== undefined && (patch.dueDate ?? null) !== (existing.dueDate ?? null)) {
        merged = {
          ...merged,
          initialDueDate: existing.initialDueDate !== undefined ? existing.initialDueDate : (existing.dueDate ?? null),
          dueDateHistory: [
            ...(existing.dueDateHistory ?? []),
            { from: existing.dueDate ?? null, to: patch.dueDate ?? null, at: nowIso() },
          ],
        }
      }
      if (patch.status && patch.status !== existing.status) {
        merged = applyTaskStatusTransition({ ...existing, ...patch }, patch.status)
      }
      const linked = merged.opportunityId
        ? oppsRef.current.find((row) => row.id === merged.opportunityId)
        : null
      if (linked) {
        merged = {
          ...merged,
          projectName: linked.projectName,
        }
      }
      if (patch.ownerId) {
        const ownerRow = findCrmUserById(patch.ownerId, users)
        if (ownerRow) merged = { ...merged, owner: ownerRow.name, ownerId: ownerRow.id }
      }
      if (!isLocalPersistence()) {
        await resourceRequest<TaskRecord>(`/tasks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(merged),
        }).catch(() => merged)
      }
      persistTasks(tasksRef.current.map((row) => (row.id === id ? merged : row)))
      persistOpps(syncOpportunitySummaries(oppsRef.current, tasksRef.current))
      touchLinkedOpportunity(merged.opportunityId)
      logChange('task', id, 'update', Object.keys(patch))
      if (patch.status === 'Done' && existing.status !== 'Done') {
        pushActivity(taskActivity(user?.name ?? null, merged, 'completed'))
      } else if (patch.archivedAt && !existing.archivedAt) {
        pushActivity(taskActivity(user?.name ?? null, merged, 'archived'))
      } else {
        pushActivity(taskActivity(user?.name ?? null, merged, 'updated'))
      }
      return merged
    },
    [owner, user, users],
  )

  const createTask = useCallback(
    async (draft: Partial<TaskRecord>) => {
      const linked = draft.opportunityId
        ? oppsRef.current.find((row) => row.id === draft.opportunityId)
        : null
      const ownerRow = findCrmUserById(draft.ownerId ?? null, users)
      if (!draft.dueDate) throw new Error('Choose a due date for the new task.')
      const record: TaskRecord = {
        id: `task_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        priority: draft.priority ?? 'B',
        action: draft.action?.trim() || 'Untitled task',
        opportunityId: draft.opportunityId ?? null,
        projectName: linked?.projectName ?? draft.projectName ?? '',
        owner: ownerRow?.name ?? draft.owner ?? '',
        ownerId: ownerRow?.id ?? draft.ownerId ?? null,
        dueDate: draft.dueDate ?? null,
        initialDueDate: draft.dueDate ?? null,
        dueDateHistory: [],
        status: draft.status ?? 'Open',
        notes: draft.notes ?? '',
        completedAt: null,
        archivedAt: null,
        deletedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      if (!isLocalPersistence()) {
        const created = await resourceRequest<TaskRecord>('/tasks', {
          method: 'POST',
          body: JSON.stringify(record),
        }).catch(() => record)
        record.id = created.id || record.id
      }
      persistTasks([record, ...tasksRef.current])
      persistOpps(syncOpportunitySummaries(oppsRef.current, tasksRef.current))
      touchLinkedOpportunity(record.opportunityId)
      logChange('task', record.id, 'create', Object.keys(draft))
      pushActivity(taskActivity(user?.name ?? null, record, 'created'))
      return record
    },
    [owner, user, users],
  )

  const archiveTask = useCallback(
    async (id: string) => {
      const existing = tasksRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Task not found')
      return saveTask(id, {
        status: 'Done',
        completedAt: existing.completedAt ?? nowIso(),
        archivedAt: nowIso(),
      })
    },
    [saveTask],
  )

  const restoreTask = useCallback(
    async (id: string) => {
      const existing = tasksRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Task not found')
      const merged = { ...existing, ...restoreTaskFields(existing, user?.name ?? null) }
      persistTasks(tasksRef.current.map((row) => (row.id === id ? merged : row)))
      persistOpps(syncOpportunitySummaries(oppsRef.current, tasksRef.current))
      touchLinkedOpportunity(merged.opportunityId)
      logChange('task', id, 'update', ['status', 'completedAt', 'archivedAt', 'restoreHistory'])
      pushActivity(taskActivity(user?.name ?? null, merged, 'restored'))
      return merged
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, user],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const existing = tasksRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Task not found')
      if (!isLocalPersistence()) {
        await resourceRequest(`/tasks/${id}`, { method: 'DELETE' }).catch(() => undefined)
      }
      persistTasks(
        tasksRef.current.map((row) =>
          row.id === id ? { ...row, deletedAt: nowIso(), updatedAt: nowIso() } : row,
        ),
      )
      persistOpps(syncOpportunitySummaries(oppsRef.current, tasksRef.current))
      touchLinkedOpportunity(existing.opportunityId)
      logChange('task', id, 'delete', ['deletedAt'])
      pushActivity(taskActivity(user?.name ?? null, existing, 'deleted', 'delete'))
    },
    [owner, user],
  )

  const saveDocument = useCallback(
    async (id: string, patch: Partial<DocumentRecord>) => {
      const existing = docsRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Document not found')
      const linked = patch.opportunityId
        ? oppsRef.current.find((row) => row.id === patch.opportunityId)
        : existing.opportunityId
          ? oppsRef.current.find((row) => row.id === existing.opportunityId)
          : null
      const merged: DocumentRecord = {
        ...existing,
        ...patch,
        projectName: linked?.projectName ?? patch.projectName ?? existing.projectName,
      }
      if (!isLocalPersistence()) {
        await resourceRequest<DocumentRecord>(`/documents/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(merged),
        }).catch(() => merged)
      }
      persistDocs(docsRef.current.map((row) => (row.id === id ? merged : row)))
      logChange('document', id, 'update', Object.keys(patch))
      pushActivity(documentActivity(user?.name ?? null, merged, 'updated'))
      return merged
    },
    [owner, user],
  )

  const createDocument = useCallback(
    async (draft: Partial<DocumentRecord>) => {
      const linked = draft.opportunityId
        ? oppsRef.current.find((row) => row.id === draft.opportunityId)
        : null
      const record: DocumentRecord = {
        id: `doc_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: draft.name?.trim() || draft.docType || 'Untitled document',
        docType: draft.docType || 'Other',
        opportunityId: draft.opportunityId ?? null,
        projectName: linked?.projectName ?? draft.projectName ?? '',
        status: draft.status ?? 'Draft',
        confidentiality: draft.confidentiality ?? 'Confidential',
        uploadedBy: draft.uploadedBy || user?.name || '',
        link: draft.link ?? '',
        uploadedAt: draft.uploadedAt || todayDateInput(),
        notes: draft.notes ?? '',
        fileType: draft.fileType ?? '',
        createdAt: nowIso(),
        fileName: draft.fileName ?? '',
        fileSize: draft.fileSize ?? 0,
        storage: draft.storage ?? (draft.link ? 'url' : 'none'),
        webUrl: draft.webUrl ?? '',
        driveItemId: draft.driveItemId ?? '',
      }
      if (!isLocalPersistence()) {
        const created = await resourceRequest<DocumentRecord>('/documents', {
          method: 'POST',
          body: JSON.stringify(record),
        }).catch(() => record)
        record.id = created.id || record.id
      }
      persistDocs([record, ...docsRef.current])
      logChange('document', record.id, 'create', Object.keys(draft))
      pushActivity(documentActivity(user?.name ?? null, record, 'linked'))
      return record
    },
    [owner, user],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      const existing = docsRef.current.find((row) => row.id === id)
      if (!existing) throw new Error('Document not found')
      if (!isLocalPersistence()) {
        await resourceRequest(`/documents/${id}`, { method: 'DELETE' }).catch(() => undefined)
      }
      persistDocs(docsRef.current.filter((row) => row.id !== id))
      void deleteDocumentBlob(owner, id).catch(() => undefined)
      logChange('document', id, 'delete', ['id'])
      pushActivity(documentActivity(user?.name ?? null, existing, 'removed'))
    },
    [owner, user],
  )

  const syncLeadName = useCallback((leadId: string, name: string) => {
    if (tasksRef.current.some((row) => row.ownerId === leadId && row.owner !== name)) {
      persistTasks(tasksRef.current.map((row) => (row.ownerId === leadId ? { ...row, owner: name } : row)))
    }
    if (!oppsRef.current.some((row) => row.primaryLeadId === leadId && row.dealLead !== name)) return
    persistOpps(oppsRef.current.map((row) => (row.primaryLeadId === leadId ? { ...row, dealLead: name } : row)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const logLeadActivity = useCallback((message: string, lead: Pick<DealLead, 'name'>) => {
    logChange('dealLeads', lead.name, 'update', ['dealLead'])
    pushActivity(makeActivity({ actor: user?.name ?? null, message, projectName: 'Deal Leads', type: 'update' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, user])

  const downloadDatabase = useCallback(() => {
    const contacts = loadOwnedCollection<ContactRecord>('contacts', owner, [])
    downloadPortableDatabase(
      buildPortableDatabase(
        {
          opportunities: oppsRef.current,
          tasks: tasksRef.current,
          documents: docsRef.current,
          activity: activityRef.current,
          contacts,
          dealLeads: loadRoster(owner),
        },
        new Date().toISOString(),
      ),
    )
  }, [owner])

  const currentRecords = () => ({
    opportunities: oppsRef.current as unknown as { id: string }[],
    tasks: tasksRef.current as unknown as { id: string }[],
    documents: docsRef.current as unknown as { id: string }[],
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, []) as unknown as { id: string }[],
    dealLeads: loadRoster(owner) as { id: string }[],
  })

  const previewImport = useCallback(async (file: Blob) => {
    let raw = ''
    try {
      raw = await file.text()
    } catch {
      return { error: DATABASE_FILE_ERROR }
    }
    const parsed = parsePortableDatabase(raw)
    if (!parsed.ok) return { error: parsed.error }
    const database = applySchemaMigrations(parsed.database)
    return { preview: compareImport(database, currentRecords(), (file as File).name || 'backup file') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const applyImport = useCallback(async (preview: ImportPreview, options: ImportOptions): Promise<ImportResult> => {
    const rows = preview.rows.filter((row) => row.kind === 'new' || (options.includeChanged && row.kind === 'changed') || (options.includeDuplicates && row.kind === 'duplicate'))
    const batchId = `import_${Date.now()}`
    if (!sharedRef.current) {
      // No shared server: the same review, applied to this browser's copy only.
      const byCollection = (name: string) => rows.filter((row) => row.collection === name)
      const merge = <T extends { id: string }>(list: T[], name: string) => {
        const incoming = new Map(byCollection(name).map((row) => [row.id, row.data as unknown as T]))
        return [...list.map((row) => incoming.get(row.id) ?? row), ...[...incoming.values()].filter((row) => !list.some((old) => old.id === row.id))]
      }
      persistTasks(merge(tasksRef.current, 'tasks'))
      persistOpps(decorateOpportunities(merge(oppsRef.current, 'opportunities'), tasksRef.current))
      persistDocs(merge(docsRef.current, 'documents'))
      saveOwnedCollection('contacts', owner, merge(loadOwnedCollection<ContactRecord>('contacts', owner, []), 'contacts'))
      const leads = merge(loadRoster(owner), 'dealLeads')
      saveOwnedCollection(DEAL_LEADS_RESOURCE, owner, leads)
      setRoster(leads)
      return { added: rows.filter((row) => row.kind !== 'changed').length, replaced: rows.filter((row) => row.kind === 'changed').length, keptDeleted: 0, failed: [] }
    }
    const changes: WorkspaceChange[] = rows.map((row) => ({
      collection: row.collection as WorkspaceCollection,
      id: row.id,
      data: row.data,
      baseRev: revRef.current.get(`${row.collection}/${row.id}`) ?? 0,
    }))
    const result = await pushWorkspaceChanges(changes, batchId)
    // Files held only in this browser go up with their records.
    const failed: string[] = []
    for (const applied of result.applied) {
      if (applied.collection !== 'documents') continue
      const blob = await getDocumentBlob(owner, applied.id).catch(() => null)
      if (blob) await uploadWorkspaceFile(applied.id, blob, (blob as File).name || applied.id).catch(() => failed.push(applied.id))
    }
    const added = result.applied.filter((row) => rows.find((r) => r.id === row.id && r.collection === row.collection)?.kind !== 'changed')
    flagSet(
      LAST_IMPORT_PREFIX + owner,
      JSON.stringify({ batchId, at: new Date().toISOString(), fileName: preview.fileName, added: added.map((row) => ({ collection: row.collection, id: row.id, rev: row.rev })) } satisfies LastImport),
    )
    const pulled = await pullWorkspace(sinceRef.current)
    sinceRef.current = pulled.serverTime
    applyShared(pulled.records, false)
    return {
      added: added.length,
      replaced: result.applied.length - added.length,
      keptDeleted: result.conflicts.filter((row) => row.deleted).length,
      failed: [...failed, ...result.conflicts.filter((row) => !row.deleted).map((row) => row.id)],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const lastImport = useCallback((): LastImport | null => {
    try {
      return JSON.parse(flagGet(LAST_IMPORT_PREFIX + owner) ?? 'null') as LastImport | null
    } catch {
      return null
    }
  }, [owner])

  /** Removes what the last import added. A record someone has since edited is left alone. */
  const undoLastImport = useCallback(async () => {
    const last = lastImport()
    if (!last || !sharedRef.current) return { removed: 0, kept: 0 }
    const result = await pushWorkspaceChanges(last.added.map((row) => ({ collection: row.collection, id: row.id, data: null, baseRev: row.rev })), `undo_${last.batchId}`)
    const pulled = await pullWorkspace(sinceRef.current)
    sinceRef.current = pulled.serverTime
    applyShared(pulled.records, false)
    flagSet(LAST_IMPORT_PREFIX + owner, null)
    return { removed: result.applied.length, kept: result.conflicts.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const localBackup = useCallback(() => getDocumentBlob(owner, LOCAL_BACKUP_DOC).catch(() => null), [owner])

  const confirmSaved = useCallback(async (revert?: SavedSnapshot) => {
    if (!sharedRef.current) return
    if (sharedTimer.current) window.clearTimeout(sharedTimer.current)
    let notices: Awaited<ReturnType<typeof queuePush>>
    try {
      notices = await queuePush()
    } catch (err) {
      if (!revert) throw err
      // The server never took this edit. Put the collection back so the screen matches the server.
      const items = [...revert.items]
      saveOwnedCollection(revert.resource, owner, items)
      if (revert.resource === DEAL_LEADS_RESOURCE) setRoster(items as DealLead[])
      const detail: ResourceChangedDetail = { resource: revert.resource, owner, source: -1, items }
      window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
      const reason = err instanceof Error ? err.message : 'The server did not answer.'
      const message = `Not saved. ${reason} Your edit is still here. Try again when the connection is back.`
      setSyncState((prev) => ({ ...prev, state: 'failed', message }))
      throw new Error(message)
    }
    const blocking = notices[0]
    if (blocking) throw new Error(blocking.notice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  /**
   * Save, then wait for the server. "Saved" appears only after it answers. If it cannot be reached
   * the change is taken back and the editor keeps its draft. If someone else saved the same field
   * first, their value stays and the editor shows what happened.
   */
  const batchDepth = useRef(0)
  /** Many saves in a row, such as a spreadsheet import, travel to the server together. */
  const saveInBatch = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    batchDepth.current += 1
    try {
      return await run()
    } finally {
      batchDepth.current -= 1
      if (batchDepth.current === 0 && sharedRef.current) await queuePush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const confirmed = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    if (!sharedRef.current || batchDepth.current > 0) return fn(...args)
    const before = { opps: oppsRef.current, tasks: tasksRef.current, docs: docsRef.current, activity: activityRef.current }
    const result = await fn(...args)
    if (sharedTimer.current) window.clearTimeout(sharedTimer.current)
    try {
      const notices = await queuePush()
      if (notices[0]) throw new SaveConflict(notices[0].notice)
    } catch (err) {
      if (!(err instanceof SaveConflict)) {
        applyingRemote.current = true
        try {
          persistOpps(before.opps)
          persistTasks(before.tasks)
          persistDocs(before.docs)
          persistActivity(before.activity)
        } finally {
          applyingRemote.current = false
        }
        const reason = err instanceof Error ? err.message : 'The server did not answer.'
        const message = `Not saved. ${reason} Your edit is still here. Try again when the connection is back.`
        setSyncState((prev) => ({ ...prev, state: 'failed', message }))
        throw new Error(message)
      }
      throw err
    }
    return result
  }
  const confirmedRef = useRef(confirmed)
  confirmedRef.current = confirmed

  /* eslint-disable react-hooks/exhaustive-deps */
  const api = useMemo(
    () => ({
      saveOpportunity: (...a: Parameters<typeof saveOpportunity>) => confirmedRef.current(saveOpportunity)(...a),
      createOpportunity: (...a: Parameters<typeof createOpportunity>) => confirmedRef.current(createOpportunity)(...a),
      deleteOpportunity: (...a: Parameters<typeof deleteOpportunity>) => confirmedRef.current(deleteOpportunity)(...a),
      saveTask: (...a: Parameters<typeof saveTask>) => confirmedRef.current(saveTask)(...a),
      createTask: (...a: Parameters<typeof createTask>) => confirmedRef.current(createTask)(...a),
      archiveTask: (...a: Parameters<typeof archiveTask>) => confirmedRef.current(archiveTask)(...a),
      restoreTask: (...a: Parameters<typeof restoreTask>) => confirmedRef.current(restoreTask)(...a),
      deleteTask: (...a: Parameters<typeof deleteTask>) => confirmedRef.current(deleteTask)(...a),
      saveDocument: (...a: Parameters<typeof saveDocument>) => confirmedRef.current(saveDocument)(...a),
      createDocument: (...a: Parameters<typeof createDocument>) => confirmedRef.current(createDocument)(...a),
      deleteDocument: (...a: Parameters<typeof deleteDocument>) => confirmedRef.current(deleteDocument)(...a),
    }),
    [saveOpportunity, createOpportunity, deleteOpportunity, saveTask, createTask, archiveTask, restoreTask, deleteTask, saveDocument, createDocument, deleteDocument],
  )
  /* eslint-enable react-hooks/exhaustive-deps */

  const deleteDealLead = useCallback(async (id: string) => {
    const lead = loadRoster(owner).find((row) => row.id === id)
    if (!lead) throw new Error('That deal lead is no longer on the roster.')
    const key = `dealLeads/${id}`
    if (sharedRef.current) {
      // The server checks for uses again inside one transaction. This screen may be out of date.
      const { rev } = await deleteWorkspaceLead(id)
      revRef.current.set(key, rev)
    } else {
      const usage = leadUsage(lead, oppsRef.current, tasksRef.current)
      if (usage.total > 0) throw new LeadInUseError(usage)
    }
    syncedRef.current.delete(key)
    const next = loadRoster(owner).filter((row) => row.id !== id)
    saveOwnedCollection(DEAL_LEADS_RESOURCE, owner, next)
    setRoster(next)
    const detail: ResourceChangedDetail = { resource: DEAL_LEADS_RESOURCE, owner, source: -1, items: next }
    window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
    deletedLeads.current.set(id, lead)
    pushActivity(makeActivity({ actor: user?.name ?? null, message: `deleted deal lead ${lead.name}`, projectName: 'Deal Leads', type: 'update' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, user])

  const undoDeleteDealLead = useCallback(async (id: string) => {
    let lead = deletedLeads.current.get(id) ?? null
    const key = `dealLeads/${id}`
    if (sharedRef.current) {
      const restored = await restoreWorkspaceLead(id)
      revRef.current.set(key, restored.rev)
      lead = restored.lead as unknown as DealLead
    }
    if (!lead) return
    const next = [lead, ...loadRoster(owner).filter((row) => row.id !== id)]
    saveOwnedCollection(DEAL_LEADS_RESOURCE, owner, next)
    setRoster(next)
    syncedRef.current.set(key, JSON.stringify(lead))
    const detail: ResourceChangedDetail = { resource: DEAL_LEADS_RESOURCE, owner, source: -1, items: next }
    window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
    deletedLeads.current.delete(id)
    pushActivity(makeActivity({ actor: user?.name ?? null, message: `restored deal lead ${lead.name}`, projectName: 'Deal Leads', type: 'update' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, user])
  const deletedLeads = useRef(new Map<string, DealLead>())

  const dismissConflict = useCallback((id: string) => setConflicts((prev) => prev.filter((row) => row.id !== id)), [])
  const sync = useMemo<SyncStatus>(() => ({ ...syncState, conflicts }), [syncState, conflicts])

  const value = useMemo(
    () => ({
      opportunities,
      tasks,
      documents,
      activity,
      users,
      dealLeads: roster,
      loading,
      error,
      isLocalPersistence: local,
      refresh,
      ...api,
      downloadDatabase,
      previewImport,
      applyImport,
      undoLastImport,
      lastImport,
      localBackup,
      confirmSaved,
      saveInBatch,
      sync,
      dismissConflict,
      deleteDealLead,
      undoDeleteDealLead,
      syncLeadName,
      logLeadActivity,
    }),
    [
      opportunities,
      tasks,
      documents,
      activity,
      users,
      roster,
      loading,
      error,
      local,
      refresh,
      api,
      downloadDatabase,
      previewImport,
      applyImport,
      undoLastImport,
      lastImport,
      localBackup,
      confirmSaved,
      saveInBatch,
      sync,
      dismissConflict,
      deleteDealLead,
      undoDeleteDealLead,
      syncLeadName,
      logLeadActivity,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
