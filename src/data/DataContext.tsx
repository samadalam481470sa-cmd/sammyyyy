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
import { fetchOpportunities, updateOpportunity } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { mockOpportunities } from '@/data/mockOpportunities'

interface DataContextValue {
  opportunities: Opportunity[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  saveOpportunity: (id: string, patch: OpportunityUpdate) => Promise<Opportunity>
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
    try {
      const data = await fetchOpportunities()
      setOpportunities(withProjectNumbers(data))
    } catch (err) {
      // Fallback keeps UI usable if API is briefly unavailable
      setOpportunities(withProjectNumbers(mockOpportunities))
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveOpportunity = useCallback(async (id: string, patch: OpportunityUpdate) => {
    const updated = await updateOpportunity(id, patch)
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updated } : o)),
    )
    return updated
  }, [])

  const value = useMemo(
    () => ({ opportunities, loading, error, refresh, saveOpportunity }),
    [opportunities, loading, error, refresh, saveOpportunity],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
