import { useEffect, useState, type RefObject } from 'react'

/**
 * Number of full rows that fit in the element's current height.
 * The element should be the scroll area that holds the table (header row included).
 * Re-measures when the window or the element resizes.
 */
export function useFitRows(
  ref: RefObject<HTMLElement | null>,
  { rowHeight, headerHeight = 41, min = 5, max = 50, fallback = 12, rowSelector = 'tbody tr', gap = 0 }: {
    rowHeight: number
    headerHeight?: number
    /** Element whose height is one row (tables use the first body row). */
    rowSelector?: string
    /** Space between rows, added to the measured row height. */
    gap?: number
    min?: number
    max?: number
    fallback?: number
  },
): number {
  const [rows, setRows] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const height = el.clientHeight
      if (!height) return
      // Prefer the real rendered sizes; fall back to the given estimates before rows exist.
      const measured = el.querySelector(rowSelector)?.getBoundingClientRect().height
      const row = (measured || rowHeight) + gap
      const head = el.querySelector('thead')?.getBoundingClientRect().height ?? headerHeight
      const fit = Math.floor((height - head + gap) / row)
      setRows(Math.max(min, Math.min(max, fit)))
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, rowHeight, headerHeight, min, max, rowSelector, gap])
  return rows
}

/** Number of columns a CSS grid currently renders (reads grid-template-columns). */
export function useGridColumns(ref: RefObject<HTMLElement | null>, fallback = 1): number {
  const [columns, setColumns] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const template = window.getComputedStyle(el).gridTemplateColumns
      const count = template && template !== 'none' ? template.trim().split(/\s+/).length : fallback
      setColumns(Math.max(1, count))
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, fallback])
  return columns
}
