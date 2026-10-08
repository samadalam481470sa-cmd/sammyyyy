import { useCallback, useEffect, useRef, useState } from 'react'
import { getStoredSession } from '@/lib/api'
import { appendDemoChange, loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'

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

export interface UseResourceOptions {
  /** Isolates localStorage so session keys never share a collection. */
  scope?: string
  /** Always mirror API results to localStorage so static hosting keeps data. */
  persistLocal?: boolean
}

function collectionName(resource: string, scope?: string) {
  return scope ? `${resource}__${scope}` : resource
}

/**
 * Loads a CRM module collection from the database API.
 * In local-demo (static hosting) mode, edits persist in localStorage so
 * reopening the share link keeps every change.
 */
export function useResource<T extends { id: string }>(
  resource: string,
  mock: T[],
  options: UseResourceOptions = {},
): ResourceApi<T> {
  const { scope, persistLocal } = options
  const storeName = collectionName(resource, scope)
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localMode = useRef(false)

  const writeLocal = useCallback(
    (next: T[]) => {
      if (persistLocal || localMode.current || isLocalDemo()) {
        saveDemoCollection(storeName, next)
      }
    },
    [persistLocal, storeName],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (isLocalDemo()) {
      localMode.current = true
      setItems(loadDemoCollection(storeName, mock))
      setLoading(false)
      return
    }
    try {
      const data = await request<T[]>(`/${resource}`)
      localMode.current = false
      setItems(data)
      if (persistLocal) saveDemoCollection(storeName, data)
    } catch (err) {
      localMode.current = true
      setItems(loadDemoCollection(storeName, mock))
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [resource, mock, storeName, persistLocal])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (localMode.current) {
        let merged: T | undefined
        setItems((prev) => {
          const next = prev.map((item) => {
            if (item.id !== id) return item
            merged = { ...item, ...patch }
            return merged
          })
          writeLocal(next)
          return next
        })
        if (!merged) throw new Error('Record not found')
        appendDemoChange({
          resourceType: resource,
          resourceId: id,
          changeType: 'update',
          changedFields: Object.keys(patch),
          actorName: 'Dennis DiCapua',
          createdAt: new Date().toISOString(),
        })
        return merged
      }
      const updated = await request<T>(`/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      setItems((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        writeLocal(next)
        return next
      })
      return updated
    },
    [resource, writeLocal],
  )

  const create = useCallback(
    async (data: Partial<T>) => {
      if (localMode.current) {
        const record = {
          ...data,
          id: `${resource}_local_${Date.now()}`,
        } as T
        setItems((prev) => {
          const next = [record, ...prev]
          writeLocal(next)
          return next
        })
        appendDemoChange({
          resourceType: resource,
          resourceId: record.id,
          changeType: 'create',
          changedFields: Object.keys(data),
          actorName: 'Dennis DiCapua',
          createdAt: new Date().toISOString(),
        })
        return record
      }
      const created = await request<T>(`/${resource}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setItems((prev) => {
        const next = [created, ...prev]
        writeLocal(next)
        return next
      })
      return created
    },
    [resource, writeLocal],
  )

  return { items, loading, error, save, create, refresh }
}
