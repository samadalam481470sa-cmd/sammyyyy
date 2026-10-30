import { useState } from 'react'

/**
 * Current page for a list, reset to 1 whenever `key` (the active filters) changes.
 * Derived during render, so changing a filter never shows a stale page first.
 */
export function usePageFor(key: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key, page: 1 })
  const page = state.key === key ? state.page : 1
  return [page, (next: number) => setState({ key, page: next })]
}
