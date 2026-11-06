/** The bell shows about ten rows, shared between its three groups in order. */
export const BELL_CAPACITY = 10

export function allocateBellSlots(meetings: number, tasks: number, mail: number, capacity = BELL_CAPACITY) {
  const shownMeetings = Math.min(meetings, capacity)
  const shownTasks = Math.min(tasks, capacity - shownMeetings)
  return { meetings: shownMeetings, tasks: shownTasks, mail: Math.min(mail, capacity - shownMeetings - shownTasks) }
}

export interface BellMeeting {
  id: string
  title: string
  start: string
  end: string
  platform: string | null
  past: boolean
}

interface EventLike {
  id: string
  subject?: string
  start: string
  end: string
  platform?: string | null
  isCancelled?: boolean
}

interface SavedLike {
  id: string
  outlookEventId?: string | null
  displayTitle?: string
  outlookSubject?: string
  start: string
  end: string
  platform?: string | null
}

/**
 * Today's meetings from this person's calendar, plus their own saved meetings not on it, each once.
 * Upcoming ones come before ones already over, and each group runs by start time.
 */
export function todaysMeetings(events: readonly EventLike[], saved: readonly SavedLike[], dayStart: Date, dayEnd: Date, now = new Date()): BellMeeting[] {
  const inDay = (iso: string) => {
    const at = new Date(iso).getTime()
    return at >= dayStart.getTime() && at < dayEnd.getTime()
  }
  const byId = new Map<string, BellMeeting>()
  const titled = (id: string, title: string, start: string, end: string, platform: string | null | undefined): BellMeeting => ({
    id,
    title: title.trim() || 'Untitled meeting',
    start,
    end,
    platform: platform ?? null,
    past: new Date(end).getTime() < now.getTime(),
  })
  for (const event of events) {
    if (event.isCancelled || !inDay(event.start)) continue
    byId.set(event.id, titled(event.id, event.subject ?? '', event.start, event.end, event.platform))
  }
  const onCalendar = (row: SavedLike) => {
    if (row.outlookEventId && byId.has(row.outlookEventId)) return true
    const title = (row.displayTitle || row.outlookSubject || '').trim().toLowerCase()
    return [...byId.values()].some((m) => m.start === row.start && m.title.toLowerCase() === title)
  }
  for (const row of saved) {
    if (!inDay(row.start) || onCalendar(row)) continue
    byId.set(row.id, titled(row.id, row.displayTitle || row.outlookSubject || '', row.start, row.end, row.platform))
  }
  return [...byId.values()].sort((a, b) => Number(a.past) - Number(b.past) || a.start.localeCompare(b.start))
}
