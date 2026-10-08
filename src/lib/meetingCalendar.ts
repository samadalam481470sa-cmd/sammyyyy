import type { AuthUser } from '@/types'
import type { NotificationItem } from '@/lib/api'

export interface CalendarEvent {
  id: string
  date: string
  time: string
  title: string
  notes: string
  remind: boolean
}

/** Stable owner for a session key — slot 1, slot 2, manager, etc. never share calendars. */
export function calendarOwnerKey(user: AuthUser | null | undefined): string {
  if (!user) return 'anonymous'
  if (user.isManager || user.authMethod === 'manager_key') return 'key:manager'
  if (user.apiKeySlot != null) return `key:slot-${user.apiKeySlot}`
  if (user.apiKeyId) return `key:${user.apiKeyId}`
  if (user.authMethod === 'demo') return 'key:demo'
  return `user:${user.id}`
}

export function calendarOwnerLabel(user: AuthUser | null | undefined): string {
  if (!user) return 'This session'
  if (user.isManager || user.authMethod === 'manager_key') return 'Managerial key calendar'
  if (user.apiKeySlot != null) return `Slot ${user.apiKeySlot} calendar`
  return `${user.name}'s calendar`
}

function storageKey(owner: string) {
  return `newport_crm_calendar_v1_${owner}`
}

function reminderKey(owner: string) {
  return `newport_crm_calendar_reminders_v1_${owner}`
}

export function loadCalendarEvents(owner: string): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(owner))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCalendarEvent)
  } catch {
    return []
  }
}

export function saveCalendarEvents(owner: string, events: CalendarEvent[]): void {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(events))
  } catch {
    // ignore quota
  }
}

function isCalendarEvent(v: unknown): v is CalendarEvent {
  if (typeof v !== 'object' || v == null) return false
  const e = v as CalendarEvent
  return typeof e.id === 'string' && typeof e.date === 'string' && typeof e.title === 'string'
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function eventsOnDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= days; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${year}-${mm}-${dd}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Reminders due today or tomorrow (and overdue same calendar day). */
export function dueCalendarEvents(events: CalendarEvent[], now = new Date()): CalendarEvent[] {
  const today = todayISO(now)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = todayISO(tomorrowDate)
  return events.filter((e) => e.remind && (e.date === today || e.date === tomorrow))
}

export function reminderNotifications(
  events: CalendarEvent[],
  user: AuthUser,
  now = new Date(),
): NotificationItem[] {
  const owner = calendarOwnerKey(user)
  const posted = loadPostedReminderIds(owner)
  const due = dueCalendarEvents(events, now)
  const today = todayISO(now)
  const items: NotificationItem[] = []

  for (const event of due) {
    const stamp = `${event.id}:${event.date}`
    if (posted.has(stamp)) continue
    const when = event.date === today ? 'today' : 'tomorrow'
    const time = event.time ? ` at ${event.time}` : ''
    items.push({
      id: `cal-reminder-${event.id}`,
      direction: 'inbound',
      from: 'Newport Meetings',
      to: user.email,
      subject: `Meeting reminder — ${event.title || 'Untitled'} (${when}${time})`,
      body: [
        `Calendar reminder for your ${calendarOwnerLabel(user)}.`,
        `Date: ${event.date}${time}`,
        event.notes ? `Notes: ${event.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      read: false,
      relatedProject: event.title || 'Meetings calendar',
      createdAt: now.toISOString(),
    })
  }
  return items
}

export function markRemindersPosted(owner: string, events: CalendarEvent[]): void {
  const posted = loadPostedReminderIds(owner)
  for (const event of events) posted.add(`${event.id}:${event.date}`)
  try {
    localStorage.setItem(reminderKey(owner), JSON.stringify([...posted]))
  } catch {
    // ignore
  }
}

function loadPostedReminderIds(owner: string): Set<string> {
  try {
    const raw = localStorage.getItem(reminderKey(owner))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}
