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
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  mockDocuments,
  mockTasksDb,
  type DocumentRecord,
  type TaskRecord,
} from '@/data/mockModules'
import { appendDemoChange, loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
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

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const owner = sessionOwnerKey(user)
  const users = useMemo(() => crmUsersForSession(user), [user])
  const local = isLocalPersistence()

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const oppsRef = useRef<Opportunity[]>([])
  const tasksRef = useRef<TaskRecord[]>([])
  const docsRef = useRef<DocumentRecord[]>([])
  const activityRef = useRef<ActivityItem[]>([])

  const persistOpps = (next: Opportunity[]) => {
    oppsRef.current = next
    saveOwnedCollection('opportunities', owner, next)
    setOpportunities(next)
  }
  const persistTasks = (next: TaskRecord[]) => {
    tasksRef.current = next
    saveOwnedCollection('tasks', owner, next)
    setTasks(next)
  }
  const persistDocs = (next: DocumentRecord[]) => {
    docsRef.current = next
    saveOwnedCollection('documents', owner, next)
    setDocuments(next)
  }
  const persistActivity = (next: ActivityItem[]) => {
    activityRef.current = next
    saveOwnedCollection('activity', owner, next)
    setActivity(next)
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

  const syncOpportunitySummaries = (opps: Opportunity[], taskList: TaskRecord[]) =>
    decorateOpportunities(opps, taskList)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
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
    setLoading(true)
    setError(null)
    const loadLocal = () => {
      const rawTasks = applyTaskArchiveRules(
        loadOwnedCollection('tasks', owner, mockTasksDb).map((row) => migrateTaskRecord(row, users)),
      )
      const rawOpps = loadOwnedCollection('opportunities', owner, mockOpportunities)
      const rawDocs = loadOwnedCollection('documents', owner, mockDocuments)
      const rawActivity = loadOwnedCollection<ActivityItem>('activity', owner, [])
      persistTasks(rawTasks.tasks)
      persistOpps(syncOpportunitySummaries(rawOpps, rawTasks.tasks))
      persistDocs(rawDocs)
      persistActivity(rawActivity)
    }
    if (isLocalPersistence()) {
      loadLocal()
      setLoading(false)
      return
    }
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
  }, [isAuthenticated, owner, users])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
