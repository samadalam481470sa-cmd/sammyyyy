import type { AuthUser } from '@/types'
import type { NotificationItem } from '@/lib/api'
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import {
  calendarOwnerKey,
  markRemindersPosted,
  reminderNotifications,
  type CalendarEvent,
} from '@/lib/meetingCalendar'

function reminderCollection(owner: string) {
  return `calendar_notifications_${owner}`
}

/** Merge due calendar reminders into THIS key's reminder inbox (not other keys). */
export function pushCalendarReminders(
  user: AuthUser | null | undefined,
  events: CalendarEvent[],
): NotificationItem[] {
  if (!user) return []
  const owner = calendarOwnerKey(user)
  const fresh = reminderNotifications(events, user)
  if (fresh.length === 0) return []

  const existing = loadDemoCollection<NotificationItem>(reminderCollection(owner), [])
  const ids = new Set(existing.map((n) => n.id))
  const toAdd = fresh.filter((n) => !ids.has(n.id))
  if (toAdd.length === 0) return []

  saveDemoCollection(reminderCollection(owner), [...toAdd, ...existing].slice(0, 100))
  markRemindersPosted(
    owner,
    events.filter((e) => toAdd.some((n) => n.id === `cal-reminder-${e.id}`)),
  )
  return toAdd
}

export function loadKeyCalendarNotifications(user: AuthUser | null | undefined): NotificationItem[] {
  if (!user) return []
  return loadDemoCollection<NotificationItem>(reminderCollection(calendarOwnerKey(user)), [])
}

export function saveKeyCalendarNotifications(
  user: AuthUser | null | undefined,
  items: NotificationItem[],
): void {
  if (!user) return
  saveDemoCollection(reminderCollection(calendarOwnerKey(user)), items)
}
