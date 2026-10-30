/**
 * Device cache of Outlook calendar events for one signed-in owner.
 * It holds only events that Microsoft Graph returned or confirmed creating. It is refreshed
 * from Graph whenever a calendar view is shown, and it is the single calendar source for
 * Email > Calendar, Meetings and reminders.
 */
import type { OutlookEvent } from '@/lib/graphCalendar'

export const CALENDAR_UPDATED = 'newport-calendar-updated'

interface Stored {
  fetchedAt: string | null
  events: OutlookEvent[]
}

function key(owner: string) {
  return `newport_crm_outlook_events_v2_${owner}`
}

export function readCalendarCache(owner: string): Stored {
  try {
    const raw = localStorage.getItem(key(owner))
    if (!raw) return { fetchedAt: null, events: [] }
    const parsed = JSON.parse(raw) as Partial<Stored>
    return {
      fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : null,
      events: Array.isArray(parsed.events) ? parsed.events.filter((e): e is OutlookEvent => typeof e?.id === 'string' && typeof e.start === 'string') : [],
    }
  } catch {
    return { fetchedAt: null, events: [] }
  }
}

function write(owner: string, stored: Stored) {
  try {
    localStorage.setItem(key(owner), JSON.stringify(stored))
  } catch {
    // quota: the in-memory list still shows this session
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CALENDAR_UPDATED, { detail: { owner } }))
}

function overlaps(event: OutlookEvent, from: Date, to: Date): boolean {
  return new Date(event.start).getTime() < to.getTime() && new Date(event.end).getTime() >= from.getTime()
}

/** Replace everything cached inside [from, to) with what Graph just returned for that range. */
export function replaceCalendarRange(owner: string, from: Date, to: Date, fresh: OutlookEvent[]): OutlookEvent[] {
  const current = readCalendarCache(owner).events
  const outside = current.filter((event) => !overlaps(event, from, to) && !fresh.some((row) => row.id === event.id))
  const events = [...outside, ...fresh].sort((a, b) => a.start.localeCompare(b.start))
  write(owner, { fetchedAt: new Date().toISOString(), events })
  return events
}

/** Add an event Graph confirmed creating. */
export function addConfirmedEvent(owner: string, event: OutlookEvent): void {
  const current = readCalendarCache(owner)
  write(owner, { ...current, events: [...current.events.filter((row) => row.id !== event.id), event].sort((a, b) => a.start.localeCompare(b.start)) })
}

export function clearCalendarCache(owner: string): void {
  try {
    localStorage.removeItem(key(owner))
  } catch {
    // ignore
  }
}

export function eventsInRange(events: OutlookEvent[], from: Date, to: Date): OutlookEvent[] {
  return events.filter((event) => !event.isCancelled && overlaps(event, from, to))
}

/** Local YYYY-MM-DD of an event's start, for day grouping. */
export function localDayOf(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function eventsByDay(events: OutlookEvent[]): Map<string, OutlookEvent[]> {
  const map = new Map<string, OutlookEvent[]>()
  for (const event of events) {
    if (event.isCancelled) continue
    const day = localDayOf(event.start)
    map.set(day, [...(map.get(day) ?? []), event])
  }
  return map
}
