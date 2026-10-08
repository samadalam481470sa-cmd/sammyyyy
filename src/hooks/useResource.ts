import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { getStoredSession } from '@/lib/api'
import {
  appendDemoChange,
  loadOwnedCollection,
  saveOwnedCollection,
} from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'

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

/**
 * Loads a CRM module collection from the database API.
 * In local-demo (static hosting) mode, edits persist in localStorage so
 * reopening the share link keeps every change — separately for each session key.
 */
export function useResource<T extends { id: string }>(
  resource: string,
  mock: T[],
  options: UseResourceOptions = {},
): ResourceApi<T> {
  const { user } = useAuth()
  const owner = options.scope ?? sessionOwnerKey(user)
  const persistLocal = options.persistLocal !== false
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localMode = useRef(false)
  const itemsRef = useRef<T[]>([])

  const writeLocal = useCallback(
    (next: T[]) => {
      if (persistLocal || localMode.current || isLocalDemo()) {
        saveOwnedCollection(resource, owner, next)
      }
    },
    [persistLocal, resource, owner],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (isLocalDemo()) {
      localMode.current = true
      const loaded = loadOwnedCollection(resource, owner, mock)
      itemsRef.current = loaded
      setItems(loaded)
      setLoading(false)
      return
    }
    try {
      const data = await request<T[]>(`/${resource}`)
      localMode.current = false
      itemsRef.current = data
      setItems(data)
      if (persistLocal) saveOwnedCollection(resource, owner, data)
    } catch (err) {
      localMode.current = true
      const loaded = loadOwnedCollection(resource, owner, mock)
      itemsRef.current = loaded
      setItems(loaded)
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [resource, mock, owner, persistLocal])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const changeMeta = () => ({
    actorName: user?.name || 'Newport user',
    ownerKey: owner,
    apiKeySlot: user?.apiKeySlot ?? null,
    authMethod: user?.authMethod,
  })

  const save = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (localMode.current) {
        const existing = itemsRef.current.find((item) => item.id === id)
        if (!existing) throw new Error('Record not found')
        const merged = { ...existing, ...patch }
        const next = itemsRef.current.map((item) => (item.id === id ? merged : item))
        itemsRef.current = next
        setItems(next)
        writeLocal(next)
        appendDemoChange({
          resourceType: resource,
          resourceId: id,
          changeType: 'update',
          changedFields: Object.keys(patch),
          createdAt: new Date().toISOString(),
          ...changeMeta(),
        })
        return merged
      }
      const updated = await request<T>(`/${resource}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const next = itemsRef.current.map((item) => (item.id === id ? { ...item, ...updated } : item))
      itemsRef.current = next
      setItems(next)
      writeLocal(next)
      return updated
    },
    [resource, writeLocal, owner, user],
  )

  const create = useCallback(
    async (data: Partial<T>) => {
      if (localMode.current) {
        const record = {
          ...data,
          id: `${resource}_local_${Date.now()}`,
        } as T
        const next = [record, ...itemsRef.current]
        itemsRef.current = next
        setItems(next)
        writeLocal(next)
        appendDemoChange({
          resourceType: resource,
          resourceId: record.id,
          changeType: 'create',
          changedFields: Object.keys(data),
          createdAt: new Date().toISOString(),
          ...changeMeta(),
        })
        return record
      }
      const created = await request<T>(`/${resource}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const next = [created, ...itemsRef.current]
      itemsRef.current = next
      setItems(next)
      writeLocal(next)
      return created
    },
    [resource, writeLocal, owner, user],
  )

  return { items, loading, error, save, create, refresh }
}
