import { describe, expect, it } from 'vitest'
import { clampPage, pageNumbers, pageOfIndex, paginate } from './paginate'

describe('paginate', () => {
  const items = Array.from({ length: 62 }, (_, i) => i + 1)

  it('reports an accurate range and page count', () => {
    const first = paginate(items, 1, 12)
    expect(first).toMatchObject({ page: 1, pageCount: 6, start: 1, end: 12, total: 62 })
    const last = paginate(items, 6, 12)
    expect(last).toMatchObject({ page: 6, start: 61, end: 62 })
    expect(last.rows).toEqual([61, 62])
  })

  it('clamps out-of-range pages and handles empty lists', () => {
    expect(paginate(items, 99, 12).page).toBe(6)
    expect(paginate([], 3, 12)).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, total: 0 })
    expect(clampPage(0, 10, 5)).toBe(1)
  })

  it('shows gaps for long page lists', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12])
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12])
  })

  it('finds the page that holds a row', () => {
    expect(pageOfIndex(0, 10)).toBe(1)
    expect(pageOfIndex(10, 10)).toBe(2)
    expect(pageOfIndex(-1, 10)).toBe(1)
  })
})
