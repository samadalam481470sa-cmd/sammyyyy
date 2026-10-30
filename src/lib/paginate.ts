/** Pure paging helpers shared by every paginated list. Filtering always happens before paging. */
export interface PageWindow<T> {
  rows: T[]
  page: number
  pageCount: number
  start: number
  end: number
  total: number
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.floor(page), pageCount)
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageWindow<T> {
  const size = Math.max(1, Math.floor(pageSize))
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = clampPage(page, total, size)
  const startIndex = (current - 1) * size
  const rows = items.slice(startIndex, startIndex + size)
  return {
    rows,
    page: current,
    pageCount,
    start: total === 0 ? 0 : startIndex + 1,
    end: startIndex + rows.length,
    total,
  }
}

/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12. */
export function pageNumbers(page: number, pageCount: number, around = 1): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const out: (number | null)[] = [1]
  const from = Math.max(2, page - around)
  const to = Math.min(pageCount - 1, page + around)
  if (from > 2) out.push(null)
  for (let n = from; n <= to; n += 1) out.push(n)
  if (to < pageCount - 1) out.push(null)
  out.push(pageCount)
  return out
}

/** The page on which a given item sits, so a selection stays visible after the page size changes. */
export function pageOfIndex(index: number, pageSize: number): number {
  if (index < 0) return 1
  return Math.floor(index / Math.max(1, pageSize)) + 1
}
