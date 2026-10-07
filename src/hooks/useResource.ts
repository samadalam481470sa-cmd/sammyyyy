import { useCallback, useEffect, useRef, useState } from 'react'
import { getStoredSession } from '@/lib/api'

const API_BASE = '/api/resources'

function isLocalDemo() {
  return getStoredSession()?.token === 'local-demo'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

export interface ResourceApi<T extends { id: string }> {
  items: T[]
  loading: boolean
  error: string | null
  save: (id: string, patch: Partial<T>) => Promise<T>
  create: (data: Partial<T>) => Promise<T>
  refresh: () => Promise<void>
}

/**
 * Loads a CRM module collection from the database API.
 * In local-demo (static hosting) mode, edits are kept in memory using the
 * provided mock records so the demo stays fully interactive.
 */
export function useResource<T extends { id: string }>(
  resource: string,
  mock: T[],
): ResourceApi<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localMode = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (isLocalDemo()) {
      localMode.current = true
      setItems(mock)
      setLoading(false)
      return
    }
    try {
      const data = await request<T[]>(`/${resource}`)
      localMode.current = false
      setItems(data)
    } catch (err) {
      localMode.current = true
      setItems(mock)
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [resource, mock])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (localMode.current) {
        let merged: T | undefined
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item
            merged = { ...item, ...patch }
            return merged
          }),
        )
        if (!merged) throw new Error('Record not found')
        return merged
      }
      const updated = await request<T>(`/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
      return updated
    },
    [resource],
  )

  const create = useCallback(
    async (data: Partial<T>) => {
      if (localMode.current) {
        const record = {
          ...data,
          id: `${resource}_local_${Date.now()}`,
        } as T
        setItems((prev) => [record, ...prev])
        return record
      }
      const created = await request<T>(`/${resource}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setItems((prev) => [created, ...prev])
      return created
    },
    [resource],
  )

  return { items, loading, error, save, create, refresh }
}
