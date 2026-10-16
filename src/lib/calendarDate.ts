const MS_DAY = 24 * 60 * 60 * 1000

/** Parse YYYY-MM-DD as a local calendar date. ISO timestamps keep their instant. */
export function parseDateValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes('T')) {
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole local calendar days from today to the date. Negative = past. */
export function calendarDaysFromToday(dateStr: string, now = new Date()): number | null {
  const parsed = parseDateValue(dateStr)
  if (!parsed) return null
  const today = startOfLocalDay(now).getTime()
  const target = startOfLocalDay(parsed).getTime()
  return Math.round((target - today) / MS_DAY)
}

export function isOverdueDate(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr) return false
  const days = calendarDaysFromToday(dateStr, now)
  return days != null && days < 0
}

export function isDueToday(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr) return false
  return calendarDaysFromToday(dateStr, now) === 0
}

/** Inclusive window: today through today+days. */
export function isWithinNextDays(
  dateStr: string | null | undefined,
  days: number,
  now = new Date(),
): boolean {
  if (!dateStr) return false
  const delta = calendarDaysFromToday(dateStr, now)
  return delta != null && delta >= 0 && delta <= days
}

export function shouldAutoArchive(completedAt: string | null | undefined, now = new Date()): boolean {
  if (!completedAt) return false
  const done = new Date(completedAt)
  if (Number.isNaN(done.getTime())) return false
  return now.getTime() - done.getTime() >= 7 * MS_DAY
}

export function nowIso(now = new Date()): string {
  return now.toISOString()
}

export function todayDateInput(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Overdue (oldest first) → today → upcoming → undated last. */
export function dueDateSortValue(dateStr: string | null | undefined, now = new Date()): number {
  if (!dateStr) return Number.POSITIVE_INFINITY
  const days = calendarDaysFromToday(dateStr, now)
  if (days == null) return Number.POSITIVE_INFINITY
  return days
}
