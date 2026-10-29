import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { getStoredSession } from '@/lib/api'
import { isLocalPersistence } from '@/lib/persistenceMode'
import {
  appendDemoChange,
  loadOwnedCollection,
  saveOwnedCollection,
} from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { registerVaultFlush } from '@/lib/userVault'
import { mergeMissingById } from '@/data/sprintSeed'

const API_BASE = '/api/resources'

/** Other screens using the same collection update at once when one saves (no manual refresh). */
export const RESOURCE_CHANGED = 'newport-resource-changed'
let instanceSeq = 0

export interface ResourceChangedDetail {
  resource: string
  owner: string
  source: number
  items: unknown[]
}

function isLocalDemo() {
  return isLocalPersistence()
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
  remove: (id: string) => Promise<void>
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
  const instanceId = useRef(0)
  if (!instanceId.current) instanceId.current = ++instanceSeq

  const writeLocal = useCallback(
    (next: T[]) => {
      if (persistLocal || localMode.current || isLocalDemo()) {
        saveOwnedCollection(resource, owner, next)
      }
      if (typeof window !== 'undefined') {
        const detail: ResourceChangedDetail = { resource, owner, source: instanceId.current, items: next }
        window.dispatchEvent(new CustomEvent(RESOURCE_CHANGED, { detail }))
      }
    },
    [persistLocal, resource, owner],
  )

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<ResourceChangedDetail>).detail
      if (!detail || detail.resource !== resource || detail.owner !== owner || detail.source === instanceId.current) return
      itemsRef.current = detail.items as T[]
      setItems(detail.items as T[])
    }
    window.addEventListener(RESOURCE_CHANGED, onChanged)
    return () => window.removeEventListener(RESOURCE_CHANGED, onChanged)
  }, [resource, owner])

  const loadLocal = useCallback(() => {
    const stored = loadOwnedCollection(resource, owner, mock)
    const loaded = mergeMissingById(stored, mock)
    if (loaded.length !== stored.length) saveOwnedCollection(resource, owner, loaded)
    return loaded
  }, [resource, owner, mock])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (isLocalDemo()) {
      localMode.current = true
      const loaded = loadLocal()
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
      const loaded = loadLocal()
      itemsRef.current = loaded
      setItems(loaded)
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [resource, mock, owner, persistLocal, loadLocal])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return registerVaultFlush(() => writeLocal(itemsRef.current))
  }, [writeLocal])

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

  const remove = useCallback(
    async (id: string) => {
      const next = itemsRef.current.filter((item) => item.id !== id)
      itemsRef.current = next
      setItems(next)
      writeLocal(next)
      if (!localMode.current) {
        await request(`/${resource}/${id}`, { method: 'DELETE' }).catch(() => undefined)
      }
      appendDemoChange({
        resourceType: resource,
        resourceId: id,
        changeType: 'delete',
        changedFields: ['id'],
        createdAt: new Date().toISOString(),
        ...changeMeta(),
      })
    },
    [resource, writeLocal, owner, user],
  )

  return { items, loading, error, save, create, remove, refresh }
}
