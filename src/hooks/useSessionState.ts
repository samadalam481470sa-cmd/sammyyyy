import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const PREFIX = 'newport_view_state:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage blocked: the view still works, it just does not remember
  }
}

/**
 * Navigation-state policy for lists, filters, searches and open drawers:
 * - A FRESH arrival (sidebar, a link, the logo) starts from defaults. What was stored is cleared.
 * - A RETURN (the Back button of a child view, which sets `state.restore`, or the browser's own
 *   Back and Forward) brings back exactly what was there.
 * Saved records, drafts and integrations are not view state and are never touched by this.
 */
export function useRestoringFromProfile(): boolean {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [restoring] = useState(() => Boolean((location.state as { restore?: boolean } | null)?.restore) || navigationType === 'POP')
  return restoring
}

/** useState kept for this browser tab, restored only on a return (see the policy above). */
export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const restoring = useRestoringFromProfile()
  const [value, setValue] = useState<T>(() => {
    if (restoring) return read(key, initial)
    write(key, initial)
    return initial
  })
  const keyRef = useRef(key)
  keyRef.current = key
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      write(keyRef.current, resolved)
      return resolved
    })
  }, [])
  return [value, set]
}

/**
 * The record whose drawer is open. Back from the Full Opportunity Profile reopens the same drawer;
 * any fresh arrival starts with no drawer open.
 */
export function useRestorableSelection(key: string): [string | null, (id: string | null) => void] {
  return useSessionState<string | null>(`${key}:selected`, null)
}

/** Scroll position of a scroll container, restored on Back from the profile. */
export function useRestorableScroll(key: string, ref: React.RefObject<HTMLElement | null>, ready = true) {
  const restoring = useRestoringFromProfile()
  useEffect(() => {
    if (!ready) return
    const el = ref.current
    if (!el) return
    if (restoring) {
      const top = read<number>(`${key}:scroll`, 0)
      requestAnimationFrame(() => {
        el.scrollTop = top
      })
    }
    const onScroll = () => write(`${key}:scroll`, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
}
