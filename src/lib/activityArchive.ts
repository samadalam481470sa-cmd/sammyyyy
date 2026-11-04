/**
 * Archive for the Recent Activity FEED only. Archiving hides an entry from the everyday feed;
 * the activity record itself and the protected Security change history are never edited or
 * deleted. Restore shows it again. Kept per signed-in account in this browser.
 */
import { useCallback, useEffect, useState } from 'react'

export const ACTIVITY_ARCHIVE_EVENT = 'newport-activity-archive-changed'

function key(owner: string) {
  return `newport_activity_archived__${owner}`
}

export function readArchivedActivity(owner: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(owner))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function write(owner: string, ids: Set<string>) {
  try {
    localStorage.setItem(key(owner), JSON.stringify([...ids]))
  } catch {
    // storage blocked: archive state is not kept, the feed still works
  }
  window.dispatchEvent(new CustomEvent(ACTIVITY_ARCHIVE_EVENT, { detail: { owner } }))
}

export function useActivityArchive(owner: string) {
  const [archived, setArchived] = useState(() => readArchivedActivity(owner))
  useEffect(() => {
    const sync = () => setArchived(readArchivedActivity(owner))
    sync()
    window.addEventListener(ACTIVITY_ARCHIVE_EVENT, sync)
    return () => window.removeEventListener(ACTIVITY_ARCHIVE_EVENT, sync)
  }, [owner])
  const archive = useCallback((id: string) => {
    const next = readArchivedActivity(owner)
    next.add(id)
    write(owner, next)
  }, [owner])
  const restore = useCallback((id: string) => {
    const next = readArchivedActivity(owner)
    next.delete(id)
    write(owner, next)
  }, [owner])
  return { archived, archive, restore }
}
