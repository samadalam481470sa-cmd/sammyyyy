import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { appendDemoChange, loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'

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
  const { isAuthenticated } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setOpportunities([])
      return
    }
    setLoading(true)
    setError(null)
    if (getStoredSession()?.token === 'local-demo') {
      setOpportunities(
        withProjectNumbers(loadDemoCollection('opportunities', mockOpportunities)),
      )
      setLoading(false)
      return
    }
    try {
      const data = await fetchOpportunities()
      setOpportunities(withProjectNumbers(data))
    } catch (err) {
      // Fallback keeps UI usable if API is briefly unavailable
      setOpportunities(
        withProjectNumbers(loadDemoCollection('opportunities', mockOpportunities)),
      )
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveOpportunity = useCallback(async (id: string, patch: OpportunityUpdate) => {
    // Static demo: persist to localStorage so reopening the link keeps edits
    if (getStoredSession()?.token === 'local-demo') {
      let merged: Opportunity | undefined
      setOpportunities((prev) => {
        const next = prev.map((o) => {
          if (o.id !== id) return o
          merged = { ...o, ...patch }
          return merged
        })
        saveDemoCollection('opportunities', next)
        return next
      })
      if (!merged) throw new Error('Opportunity not found')
      appendDemoChange({
        resourceType: 'opportunity',
        resourceId: id,
        changeType: 'update',
        changedFields: Object.keys(patch),
        actorName: 'Dennis DiCapua',
        createdAt: new Date().toISOString(),
      })
      return merged
    }
    const updated = await updateOpportunity(id, patch)
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updated } : o)),
    )
    return updated
  }, [])

  const createOpportunity = useCallback(async (draft: Partial<Opportunity>) => {
    if (getStoredSession()?.token === 'local-demo') {
      let created!: Opportunity
      setOpportunities((prev) => {
        const projectNumber = prev.reduce((m, o) => Math.max(m, o.projectNumber ?? 0), 0) + 1
        created = {
          id: `opp_local_${Date.now()}`,
          projectNumber,
          projectName: draft.projectName ?? `Project ${projectNumber}`,
          entityName: draft.entityName ?? 'Imported Entity',
          type: draft.type ?? 'Platform Acquisition',
          status: draft.status ?? 'Pending',
          stage: draft.stage ?? 'Target Identified',
          dealLead: draft.dealLead ?? 'Dennis DiCapua',
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
        const next = [...prev, created]
        saveDemoCollection('opportunities', next)
        return next
      })
      appendDemoChange({
        resourceType: 'opportunity',
        resourceId: created.id,
        changeType: 'create',
        changedFields: Object.keys(draft),
        actorName: 'Dennis DiCapua',
        createdAt: new Date().toISOString(),
      })
      return created
    }
    const created = await apiCreateOpportunity(draft)
    setOpportunities((prev) => [...prev, created])
    return created
  }, [])

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
