import type { NavItem } from '@/data/constants'

const STORAGE_PREFIX = 'newport_crm_nav_order_v1_'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

/** Insert newly added nav ids near their default neighbors (e.g. meetings before security). */
export function mergeNavOrderWithDefaults(
  defaultIds: string[],
  saved: string[] | null | undefined,
): string[] {
  if (!saved?.length) return defaultIds
  const next = saved.filter((id) => defaultIds.includes(id))
  for (const id of defaultIds) {
    if (next.includes(id)) continue
    const defaultIndex = defaultIds.indexOf(id)
    // Prefer inserting before the next default neighbor that already exists in saved order
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
  return next
}

/** Apply a saved id order onto the visible nav list; unknown/new items keep default relative order. */
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
  return next
}
