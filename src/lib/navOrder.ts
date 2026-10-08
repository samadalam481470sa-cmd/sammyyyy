import type { NavItem } from '@/data/constants'

/** v2 resets broken demo orders so Dashboard stays on top for everyone. */
const STORAGE_PREFIX = 'newport_crm_nav_order_v2_'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

/**
 * Merge newly added nav ids into a saved order near their default neighbors.
 * Always keeps `dashboard` first when present in defaults.
 */
export function mergeNavOrderWithDefaults(
  defaultIds: string[],
  saved: string[] | null | undefined,
): string[] {
  if (!saved?.length) return defaultIds

  // Corrupted / experimental orders (Meetings or Security first) → fall back to defaults
  if (defaultIds[0] === 'dashboard' && saved[0] !== 'dashboard') {
    return defaultIds
  }

  const next = saved.filter((id) => defaultIds.includes(id))
  for (const id of defaultIds) {
    if (next.includes(id)) continue
    const defaultIndex = defaultIds.indexOf(id)
    let inserted = false
    for (let i = defaultIndex + 1; i < defaultIds.length; i++) {
      const neighborPos = next.indexOf(defaultIds[i])
      if (neighborPos >= 0) {
        next.splice(neighborPos, 0, id)
        inserted = true
        break
      }
    }
    if (!inserted) next.push(id)
  }

  // Hard guarantee: Dashboard stays first
  if (defaultIds.includes('dashboard')) {
    const without = next.filter((id) => id !== 'dashboard')
    return ['dashboard', ...without]
  }
  return next
}

/** Apply a saved id order onto the visible nav list. */
export function applyNavOrder(items: NavItem[], order: string[] | null | undefined): NavItem[] {
  const defaultIds = items.map((i) => i.id)
  const merged = mergeNavOrderWithDefaults(defaultIds, order)
  const byId = new Map(items.map((item) => [item.id, item]))
  return merged.map((id) => byId.get(id)).filter(Boolean) as NavItem[]
}

export function loadLocalNavOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLocalNavOrder(userId: string, order: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(order))
  } catch {
    // private mode / quota — ignore
  }
}

/** Move item at fromIndex to toIndex within a list of ids. */
export function moveNavId(order: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return order
  }
  const next = [...order]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  // Keep dashboard pinned at top after a drag if user accidentally moves it
  if (next.includes('dashboard') && next[0] !== 'dashboard') {
    const rest = next.filter((id) => id !== 'dashboard')
    return ['dashboard', ...rest]
  }
  return next
}
