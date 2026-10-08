import type { NavItem } from '@/data/constants'

const STORAGE_PREFIX = 'newport_crm_nav_order_v1_'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

/** Apply a saved id order onto the visible nav list; unknown/new items keep default relative order at the end. */
export function applyNavOrder(items: NavItem[], order: string[] | null | undefined): NavItem[] {
  if (!order?.length) return items
  const remaining = new Map(items.map((item) => [item.id, item]))
  const ordered: NavItem[] = []
  for (const id of order) {
    const item = remaining.get(id)
    if (!item) continue
    ordered.push(item)
    remaining.delete(id)
  }
  for (const item of items) {
    if (remaining.has(item.id)) ordered.push(item)
  }
  return ordered
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
