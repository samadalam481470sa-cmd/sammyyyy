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
import type { Opportunity, OpportunityUpdate } from '@/types'
import {
  createOpportunity as apiCreateOpportunity,
  fetchOpportunities,
  getStoredSession,
  updateOpportunity,
} from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { mockOpportunities } from '@/data/mockOpportunities'
import { appendDemoChange, loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'

interface DataContextValue {
  opportunities: Opportunity[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  saveOpportunity: (id: string, patch: OpportunityUpdate) => Promise<Opportunity>
  createOpportunity: (draft: Partial<Opportunity>) => Promise<Opportunity>
}

const DataContext = createContext<DataContextValue | null>(null)

function withProjectNumbers(list: Opportunity[]): Opportunity[] {
  return list.map((o, i) => ({
    ...o,
    projectNumber: o.projectNumber ?? i + 1,
    outstandingItems: o.outstandingItems ?? [],
    diligenceNotes: o.diligenceNotes ?? '',
  }))
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const owner = sessionOwnerKey(user)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Opportunity[]>([])

  const persist = (next: Opportunity[]) => {
    itemsRef.current = next
    saveOwnedCollection('opportunities', owner, next)
  }

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      itemsRef.current = []
      setOpportunities([])
      return
    }
    setLoading(true)
    setError(null)
    if (getStoredSession()?.token === 'local-demo') {
      const loaded = withProjectNumbers(
        loadOwnedCollection('opportunities', owner, mockOpportunities),
      )
      itemsRef.current = loaded
      setOpportunities(loaded)
      setLoading(false)
      return
    }
    try {
      const data = withProjectNumbers(await fetchOpportunities())
      itemsRef.current = data
      setOpportunities(data)
      saveOwnedCollection('opportunities', owner, data)
    } catch (err) {
      const loaded = withProjectNumbers(
        loadOwnedCollection('opportunities', owner, mockOpportunities),
      )
      itemsRef.current = loaded
      setOpportunities(loaded)
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, owner])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const changeMeta = () => ({
    actorName: user?.name || 'Newport user',
    ownerKey: owner,
    apiKeySlot: user?.apiKeySlot ?? null,
    authMethod: user?.authMethod,
  })

  const saveOpportunity = useCallback(
    async (id: string, patch: OpportunityUpdate) => {
      if (getStoredSession()?.token === 'local-demo') {
        const existing = itemsRef.current.find((o) => o.id === id)
        if (!existing) throw new Error('Opportunity not found')
        const merged = { ...existing, ...patch }
        const next = itemsRef.current.map((o) => (o.id === id ? merged : o))
        persist(next)
        setOpportunities(next)
        appendDemoChange({
          resourceType: 'opportunity',
          resourceId: id,
          changeType: 'update',
          changedFields: Object.keys(patch),
          createdAt: new Date().toISOString(),
          ...changeMeta(),
        })
        return merged
      }
      const updated = await updateOpportunity(id, patch)
      const next = itemsRef.current.map((o) => (o.id === id ? { ...o, ...updated } : o))
      persist(next)
      setOpportunities(next)
      return updated
    },
    [owner, user],
  )

  const createOpportunity = useCallback(
    async (draft: Partial<Opportunity>) => {
      if (getStoredSession()?.token === 'local-demo') {
        const projectNumber =
          itemsRef.current.reduce((m, o) => Math.max(m, o.projectNumber ?? 0), 0) + 1
        const created: Opportunity = {
          id: `opp_local_${Date.now()}`,
          projectNumber,
          projectName: draft.projectName ?? `Project ${projectNumber}`,
          entityName: draft.entityName ?? 'Imported Entity',
          type: draft.type ?? 'Platform Acquisition',
          status: draft.status ?? 'Pending',
          stage: draft.stage ?? 'Target Identified',
          dealLead: draft.dealLead ?? user?.name ?? 'Dennis DiCapua',
          sourceType: draft.sourceType ?? 'Other',
          sourceName: draft.sourceName ?? 'Excel import',
          specialty: draft.specialty ?? '',
          geography: draft.geography ?? '',
          nwp: draft.nwp ?? 0,
          netRevenue: draft.netRevenue ?? 0,
          pfEbitda: draft.pfEbitda ?? 0,
          nextAction: draft.nextAction ?? 'Review imported data',
          nextActionDate: draft.nextActionDate ?? new Date().toISOString().slice(0, 10),
          priority: draft.priority ?? 'B',
          lastActivityDate: new Date().toISOString(),
          needsAttention: draft.needsAttention ?? false,
          attentionReasons: draft.attentionReasons ?? [],
          outstandingItems: draft.outstandingItems ?? [],
          diligenceNotes: draft.diligenceNotes ?? '',
        }
        const next = [...itemsRef.current, created]
        persist(next)
        setOpportunities(next)
        appendDemoChange({
          resourceType: 'opportunity',
          resourceId: created.id,
          changeType: 'create',
          changedFields: Object.keys(draft),
          createdAt: new Date().toISOString(),
          ...changeMeta(),
        })
        return created
      }
      const created = await apiCreateOpportunity(draft)
      const next = [...itemsRef.current, created]
      persist(next)
      setOpportunities(next)
      return created
    },
    [owner, user],
  )

  const value = useMemo(
    () => ({ opportunities, loading, error, refresh, saveOpportunity, createOpportunity }),
    [opportunities, loading, error, refresh, saveOpportunity, createOpportunity],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
