/**
 * Persistent local demo store for static hosting (GitHub Pages / CDN).
 * Saves CRM data in localStorage so edits survive closing and reopening the link.
 */

const PREFIX = 'newport_crm_demo_v1_'

function key(name: string) {
  return `${PREFIX}${name}`
}

export function loadDemoCollection<T>(name: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key(name))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

export function saveDemoCollection<T>(name: string, items: T[]): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(items))
  } catch {
    // Quota / private mode — ignore; in-memory still works for the session
  }
}

export function ownedStoreName(resource: string, ownerKey: string) {
  return `${resource}__${ownerKey}`
}

/** Per-key CRM collection. First visit copies any shared legacy store, then diverges. */
export function loadOwnedCollection<T>(resource: string, ownerKey: string, fallback: T[]): T[] {
  const scoped = ownedStoreName(resource, ownerKey)
  try {
    const scopedRaw = localStorage.getItem(key(scoped))
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : fallback
    }
    const legacyRaw = localStorage.getItem(key(resource))
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as unknown
      if (Array.isArray(parsed)) {
        saveDemoCollection(scoped, parsed as T[])
        return parsed as T[]
      }
    }
  } catch {
    // ignore
  }
  return fallback
}

export function saveOwnedCollection<T>(resource: string, ownerKey: string, items: T[]): void {
  saveDemoCollection(ownedStoreName(resource, ownerKey), items)
}

export interface DemoChange {
  resourceType: string
  resourceId: string
  changeType: string
  changedFields: string[]
  actorName: string
  createdAt: string
  ownerKey?: string
  apiKeySlot?: number | null
  authMethod?: string
}

export function appendDemoChange(entry: DemoChange): void {
  try {
    const owner = entry.ownerKey ?? 'anonymous'
    const row: DemoChange = { ...entry, ownerKey: owner }
    const scoped = loadDemoCollection<DemoChange>(`change_history__${owner}`, [])
    saveDemoCollection(`change_history__${owner}`, [row, ...scoped].slice(0, 500))
    const all = loadDemoCollection<DemoChange>('change_history__all', [])
    saveDemoCollection('change_history__all', [row, ...all].slice(0, 500))
    saveDemoCollection('change_history', [row, ...all].slice(0, 500))
  } catch {
    // ignore
  }
}

export function loadDemoChangeHistory(ownerKey?: string): DemoChange[] {
  if (ownerKey) return loadDemoCollection<DemoChange>(`change_history__${ownerKey}`, [])
  return loadAllKeyChangeHistory()
}

export function loadAllKeyChangeHistory(): DemoChange[] {
  const combined = loadDemoCollection<DemoChange>('change_history__all', [])
  if (combined.length) return combined
  const owners = [
    'key:slot-1',
    'key:slot-2',
    'key:slot-3',
    'key:slot-4',
    'key:slot-5',
    'key:manager',
    'key:demo',
  ]
  const merged = owners.flatMap((owner) =>
    loadDemoCollection<DemoChange>(`change_history__${owner}`, []),
  )
  if (merged.length) {
    return [...merged].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return loadDemoCollection<DemoChange>('change_history', [])
}

/** Issued local-demo API keys (plaintext → slot) so revoke can block login. */
export type LocalIssuedKey = { slot: number; plaintext: string; status: 'active' | 'revoked' }

export function loadLocalIssuedKeys(): LocalIssuedKey[] {
  return loadDemoCollection<LocalIssuedKey>('issued_api_keys', [
    {
      slot: 1,
      plaintext: 'nwp_demo_key_slot1_replace_me_by_security_team',
      status: 'active',
    },
  ])
}

export function saveLocalIssuedKeys(keys: LocalIssuedKey[]): void {
  saveDemoCollection('issued_api_keys', keys)
}

export function revokeLocalIssuedKey(slot: number): void {
  const next = loadLocalIssuedKeys().map((k) =>
    k.slot === slot ? { ...k, status: 'revoked' as const } : k,
  )
  // Ensure slot exists even if never provisioned in this browser
  if (!next.some((k) => k.slot === slot)) {
    next.push({ slot, plaintext: '', status: 'revoked' })
  }
  saveLocalIssuedKeys(next)
}

export function registerLocalIssuedKey(slot: number, plaintext: string): void {
  const others = loadLocalIssuedKeys().filter((k) => k.slot !== slot)
  saveLocalIssuedKeys([...others, { slot, plaintext, status: 'active' }])
}

export function findLocalIssuedKey(plaintext: string): LocalIssuedKey | undefined {
  return loadLocalIssuedKeys().find((k) => k.plaintext && k.plaintext === plaintext)
}

export function isLocalSlotRevoked(slot: number): boolean {
  const slots = loadDemoCollection<{ slot: number; status: string }>('api_key_slots', [])
  const fromSlots = slots.find((s) => s.slot === slot)
  if (fromSlots?.status === 'revoked') return true
  const issued = loadLocalIssuedKeys().find((k) => k.slot === slot)
  return issued?.status === 'revoked'
}
