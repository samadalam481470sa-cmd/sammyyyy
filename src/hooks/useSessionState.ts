import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

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
 * useState that survives leaving the page and coming back in this browser tab
 * (filters, search, page number). Cleared when the tab closes.
 */
export function useSessionState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))
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

/** True when this page was reached with the Back button of a Full Opportunity Profile. */
export function useRestoringFromProfile(): boolean {
  const location = useLocation()
  const [restoring] = useState(() => Boolean((location.state as { restore?: boolean } | null)?.restore))
  return restoring
}

/**
 * The record whose drawer is open. It is remembered so that Back from the Full Opportunity
 * Profile reopens the same drawer; any other arrival starts with no drawer open.
 */
export function useRestorableSelection(key: string): [string | null, (id: string | null) => void] {
  const restoring = useRestoringFromProfile()
  const [stored, setStored] = useSessionState<string | null>(`${key}:selected`, null)
  const [value, setValue] = useState<string | null>(() => (restoring ? stored : null))
  useEffect(() => {
    if (!restoring && stored) setStored(null)
    // run once on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const set = useCallback(
    (id: string | null) => {
      setValue(id)
      setStored(id)
    },
    [setStored],
  )
  return [value, set]
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
