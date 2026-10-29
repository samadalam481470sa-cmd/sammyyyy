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
  workspaceApiBase,
  type WorkspaceCollection,
  type WorkspaceRecord,
} from '@/lib/workspaceSync'
import { DOCUMENT_TYPES_CHANGED, saveCustomTypes, storedCustomTypes } from '@/lib/documentTypes'
import { RESOURCE_CHANGED, type ResourceChangedDetail } from '@/hooks/useResource'
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
  importPortableText,
  mergeSeedRecords,
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
import { crmUsersForSession, findCrmUserById, type CrmUser } from '@/lib/crmUsers'
import { nextProjectNumber } from '@/lib/dealId'
import { nowIso } from '@/lib/calendarDate'
import { isLocalPersistence } from '@/lib/persistenceMode'
import { deleteDocumentBlob } from '@/lib/documentFileStore'
import {
  applyTaskArchiveRules,
  applyTaskStatusTransition,
  migrateTaskRecord,
} from '@/lib/taskLifecycle'
import {
  applyNextActionSummary,
  nextActionFieldsTouched,
  preserveManualNextAction,
  syncDrivingTaskFromOpportunityPatch,
  withManualNextActionOverride,
} from '@/lib/nextAction'
import { withLiveAttention } from '@/lib/attention'
import {
  documentActivity,
  opportunityCreateActivity,
  opportunityDeleteActivity,
  opportunityUpdateActivity,
  taskActivity,
} from '@/lib/activityLog'

interface DataContextValue {
  opportunities: Opportunity[]
  tasks: TaskRecord[]
  documents: DocumentRecord[]
  activity: ActivityItem[]
  users: CrmUser[]
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
  deleteTask: (id: string) => Promise<void>
  saveDocument: (id: string, patch: Partial<DocumentRecord>) => Promise<DocumentRecord>
  createDocument: (draft: Partial<DocumentRecord>) => Promise<DocumentRecord>
  deleteDocument: (id: string) => Promise<void>
  downloadDatabase: () => void
  importDatabase: (file: File) => Promise<string | null>
}

const DataContext = createContext<DataContextValue | null>(null)

const API_BASE = '/api/resources'

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

function snapshotLocalCrm(owner: string, users: CrmUser[]) {
  const loaded = {
    opportunities: loadOwnedCollection<Opportunity>('opportunities', owner, mockOpportunities),
    tasks: loadOwnedCollection<TaskRecord>('tasks', owner, mockTasksDb),
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts),
    documents: loadOwnedCollection<DocumentRecord>('documents', owner, mockDocuments),
    activity: loadOwnedCollection<ActivityItem>('activity', owner, []),
  }
  return presentDatabase(persistMigratedDatabase(owner, loaded), users)
}

function presentDatabase(database: PortableDatabase, users: CrmUser[]) {
  const rawTasks = applyTaskArchiveRules(database.tasks.map((row) => migrateTaskRecord(row, users)))
  return {
    tasks: rawTasks.tasks,
    opportunities: decorateOpportunities(database.opportunities, rawTasks.tasks),
    documents: database.documents,
    activity: database.activity,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const owner = sessionOwnerKey(user)
  const users = useMemo(() => crmUsersForSession(user), [user])
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
    persistActivity([item, ...activityRef.current].slice(0, 200))
  }

  const cloudTimer = useRef<number | null>(null)
  const allowCloudPush = useRef(false)
  const cloudEpoch = useRef(0)
  const seedAddedOnPull = useRef(false)
  const fetchedSeedRef = useRef<SeedSnapshot | null>(null)
  // ── Shared workspace (server) sync ────────────────────────────────────────
  const sharedRef = useRef(false)
  const syncedRef = useRef<Map<string, string>>(new Map())
  const sinceRef = useRef<string | null>(null)
  const sharedTimer = useRef<number | null>(null)
  const pushingRef = useRef(false)

  const workspaceSnapshot = (): Record<WorkspaceCollection, { id: string }[]> => ({
    opportunities: oppsRef.current,
    tasks: tasksRef.current,
    documents: docsRef.current,
    contacts: loadOwnedCollection<ContactRecord>('contacts', owner, mockContacts),
    activity: activityRef.current,
    documentTypes: storedCustomTypes().map((name) => ({ id: name.toLowerCase(), name })),
  })

  const snapshotKeys = () => {
    const map = new Map<string, string>()
    for (const [collection, rows] of Object.entries(workspaceSnapshot())) {
      for (const row of rows) if (row?.id) map.set(`${collection}/${row.id}`, JSON.stringify(row))
    }
    return map
  }

  /** Send only records that changed since the last sync, so people editing different records never collide. */
  const pushShared = async () => {
    if (!sharedRef.current || pushingRef.current) return
    pushingRef.current = true
    try {
      const current = snapshotKeys()
      const changes: { collection: WorkspaceCollection; id: string; data: unknown | null }[] = []
      for (const [key, json] of current) {
        if (syncedRef.current.get(key) === json) continue
        const [collection, ...rest] = key.split('/')
        changes.push({ collection: collection as WorkspaceCollection, id: rest.join('/'), data: JSON.parse(json) })
      }
      for (const key of syncedRef.current.keys()) {
        if (current.has(key)) continue
        const [collection, ...rest] = key.split('/')
        changes.push({ collection: collection as WorkspaceCollection, id: rest.join('/'), data: null })
      }
      if (!changes.length) return
      await pushWorkspaceChanges(changes)
      syncedRef.current = current
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? `Not saved to the server yet: ${err.message} It will retry.` : 'Not saved to the server yet. It will retry.')
      if (sharedTimer.current) window.clearTimeout(sharedTimer.current)
      sharedTimer.current = window.setTimeout(() => void pushShared(), 8000)
    } finally {
      pushingRef.current = false
    }
  }

  /** Apply records from the server. A full pull replaces local data; a partial pull merges. */
  const applyShared = (records: WorkspaceRecord[], full: boolean) => {
    const base = workspaceSnapshot()
    const touched = new Set<string>()
    const collections = {} as Record<WorkspaceCollection, Map<string, unknown>>
    for (const name of Object.keys(base) as WorkspaceCollection[]) {
      collections[name] = new Map(full ? [] : base[name].map((row) => [row.id, row]))
    }
    for (const record of records) {
      const target = collections[record.collection]
      if (!target) continue
      touched.add(`${record.collection}/${record.id}`)
      if (record.deleted || !record.data) target.delete(record.id)
      else target.set(record.id, record.data)
    }
    if (!full && !touched.size) return
    const list = <T,>(name: WorkspaceCollection) => [...collections[name].values()] as T[]
    const contacts = list<ContactRecord>('contacts')
    saveOwnedCollection('contacts', owner, contacts)
    const detail: ResourceChangedDetail = { resource: 'contacts', owner, source: -1, items: contacts }
    window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
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
    else for (const key of touched) {
      const json = now.get(key)
      if (json) syncedRef.current.set(key, json)
      else syncedRef.current.delete(key)
    }
  }
  const applyingRemote = useRef(false)

  const pushCloud = () => {
    if (sharedRef.current) {
      if (applyingRemote.current) return
      if (sharedTimer.current) window.clearTimeout(sharedTimer.current)
      sharedTimer.current = window.setTimeout(() => void pushShared(), 600)
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

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      sharedRef.current = false
      syncedRef.current = new Map()
      sinceRef.current = null
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
      const snap = snapshotLocalCrm(owner, users)
      persistTasks(snap.tasks)
      persistOpps(snap.opportunities)
      persistDocs(snap.documents)
      persistActivity(snap.activity)
    }
    if (isLocalPersistence()) {
      loadLocal()
      setLoading(false)
      if (isWorkspaceShared() || (await workspaceApiBase())) {
        // Shared company workspace: the server is the source of truth for every approved user.
        try {
          const pulled = await pullWorkspace()
          sharedRef.current = true
          sinceRef.current = pulled.serverTime
          if (pulled.empty) {
            // First person on a new server: their records become the shared starting data.
            syncedRef.current = new Map()
            void pushShared()
          } else {
            applyShared(pulled.records, true)
          }
          setError(null)
        } catch (err) {
          sharedRef.current = false
          setError(err instanceof Error ? `Shared workspace unavailable: ${err.message}` : 'Shared workspace unavailable.')
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
            const merged = mergeSeedRecords(
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
      const rawTasks = applyTaskArchiveRules(apiTasks.map((row) => migrateTaskRecord(row, users)))
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
  }, [isAuthenticated, owner, users, user])

  useEffect(() => {
    writeDatabaseRef.current = (database, sync) => {
      if (sync) {
        cloudEpoch.current += 1
        allowCloudPush.current = true
      }
      saveOwnedCollection('contacts', owner, database.contacts)
      writeStoredSchemaVersion(owner, SCHEMA_VERSION)
      const presented = presentDatabase(database, users)
      persistTasks(presented.tasks)
      persistOpps(presented.opportunities)
      persistDocs(presented.documents)
      persistActivity(presented.activity)
    }
  })

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Other people's changes arrive every 10 seconds (and right away when the window regains focus).
  useEffect(() => {
    if (!isAuthenticated) return
    let running = false
    const poll = async () => {
      if (!sharedRef.current || running || document.visibilityState === 'hidden') return
      running = true
      try {
        const pulled = await pullWorkspace(sinceRef.current)
        sinceRef.current = pulled.serverTime
        applyShared(pulled.records, false)
      } catch {
        // offline or server busy: the next poll retries
      } finally {
        running = false
      }
    }
    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<ResourceChangedDetail>).detail
      if (detail?.resource === 'contacts' && detail.source !== -1) pushCloud()
    }
    const onTypes = () => pushCloud()
    const onState = () => {
      if (!isWorkspaceShared()) return
      if (!sharedRef.current) void refresh()
    }
    const timer = window.setInterval(() => void poll(), 10_000)
    window.addEventListener('focus', poll)
    window.addEventListener(RESOURCE_CHANGED, onLocalChange)
    window.addEventListener(DOCUMENT_TYPES_CHANGED, onTypes)
    window.addEventListener(WORKSPACE_STATE_EVENT, onState)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', poll)
      window.removeEventListener(RESOURCE_CHANGED, onLocalChange)
      window.removeEventListener(DOCUMENT_TYPES_CHANGED, onTypes)
      window.removeEventListener(WORKSPACE_STATE_EVENT, onState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, owner])

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
      void fetchSeedSnapshot(document.baseURI).then((seed) => {
        if (cancelled || !seed || microsoftLoginInProgress()) return
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
        const merged = mergeSeedRecords(current, seed)
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
      if (nextActionFieldsTouched(patch)) {
        const synced = syncDrivingTaskFromOpportunityPatch(existing, taskList, patch)
        taskList = synced.tasks
        if (synced.drivingId) persistTasks(taskList)
      }
      const nextPatch: OpportunityUpdate = {
        ...withManualNextActionOverride(patch),
        lastActivityDate: nowIso(),
      }
      const mergedBase = { ...existing, ...nextPatch }
      const merged = decorateOpportunities([mergedBase], taskList)[0]
      if (isLocalPersistence()) {
        persistOpps(oppsRef.current.map((row) => (row.id === id ? merged : row)))
        logChange('opportunity', id, 'update', Object.keys(patch))
        pushActivity(opportunityUpdateActivity(user?.name ?? null, existing, patch))
        return merged
      }
      const updated = await updateOpportunity(id, nextPatch)
      const decorated = decorateOpportunities([{ ...existing, ...updated }], taskList)[0]
      persistOpps(oppsRef.current.map((row) => (row.id === id ? decorated : row)))
      pushActivity(opportunityUpdateActivity(user?.name ?? null, existing, patch))
      return decorated
    },
    [owner, user],
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
        }
        const created = decorateOpportunities([createdBase], tasksRef.current)[0]
        persistOpps([...oppsRef.current, created])
        logChange('opportunity', created.id, 'create', Object.keys(draft))
        pushActivity(opportunityCreateActivity(user?.name ?? null, created))
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
    [owner, user],
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
      const record: TaskRecord = {
        id: `task_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        priority: draft.priority ?? 'B',
        action: draft.action?.trim() || 'Untitled task',
        opportunityId: draft.opportunityId ?? null,
        projectName: linked?.projectName ?? draft.projectName ?? '',
        owner: ownerRow?.name ?? draft.owner ?? '',
        ownerId: ownerRow?.id ?? draft.ownerId ?? null,
        dueDate: draft.dueDate ?? null,
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
        uploadedAt: draft.uploadedAt || nowIso().slice(0, 10),
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
        },
        new Date().toISOString(),
      ),
    )
  }, [owner])

  const importDatabase = useCallback(async (file: File) => {
    let raw = ''
    try {
      raw = await file.text()
    } catch {
      return DATABASE_FILE_ERROR
    }
    let result = importPortableText(raw, bundledSeedSnapshot())
    if (!result.ok) return result.error
    if (fetchedSeedRef.current) {
      result = { ok: true, database: mergeSeedRecords(result.database, fetchedSeedRef.current) }
    }
    writeDatabaseRef.current(result.database, true)
    return null
  }, [])

  const value = useMemo(
    () => ({
      opportunities,
      tasks,
      documents,
      activity,
      users,
      loading,
      error,
      isLocalPersistence: local,
      refresh,
      saveOpportunity,
      createOpportunity,
      deleteOpportunity,
      saveTask,
      createTask,
      archiveTask,
      deleteTask,
      saveDocument,
      createDocument,
      deleteDocument,
      downloadDatabase,
      importDatabase,
    }),
    [
      opportunities,
      tasks,
      documents,
      activity,
      users,
      loading,
      error,
      local,
      refresh,
      saveOpportunity,
      createOpportunity,
      deleteOpportunity,
      saveTask,
      createTask,
      archiveTask,
      deleteTask,
      saveDocument,
      createDocument,
      deleteDocument,
      downloadDatabase,
      importDatabase,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
