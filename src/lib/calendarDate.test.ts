import { describe, expect, it } from 'vitest'
import {
  calendarDaysFromToday,
  isOverdueDate,
  isWithinNextDays,
  shouldAutoArchive,
} from './calendarDate'

const NOW = new Date(2026, 9, 16, 15, 0, 0) // Oct 16, 2026, 3 PM local

describe('calendarDate', () => {
  it('treats past calendar dates as overdue using today, not a sample date', () => {
    expect(isOverdueDate('2026-09-24', NOW)).toBe(true)
    expect(isOverdueDate('2026-10-16', NOW)).toBe(false)
    expect(calendarDaysFromToday('2026-10-16', NOW)).toBe(0)
  })

  it('includes today in the next-seven-day window', () => {
    expect(isWithinNextDays('2026-10-16', 7, NOW)).toBe(true)
    expect(isWithinNextDays('2026-10-23', 7, NOW)).toBe(true)
    expect(isWithinNextDays('2026-10-24', 7, NOW)).toBe(false)
  })

  it('archives done tasks seven days after completedAt', () => {
    const day = 24 * 60 * 60 * 1000
    expect(shouldAutoArchive(new Date(NOW.getTime() - 7 * day - 60_000).toISOString(), NOW)).toBe(true)
    expect(shouldAutoArchive(new Date(NOW.getTime() - 6 * day).toISOString(), NOW)).toBe(false)
  })

  it('uses the local calendar day at midnight edges (Oct 30, Nov 1, Nov 6, Nov 7)', () => {
    const justBeforeMidnight = new Date(2026, 9, 30, 23, 59, 30)
    const justAfterMidnight = new Date(2026, 9, 31, 0, 0, 30)
    expect(isOverdueDate('2026-10-30', justBeforeMidnight)).toBe(false)
    expect(isOverdueDate('2026-10-30', justAfterMidnight)).toBe(true)
    const morning = new Date(2026, 9, 30, 7, 0, 0)
    expect(calendarDaysFromToday('2026-10-30', morning)).toBe(0)
    expect(isWithinNextDays('2026-11-01', 7, morning)).toBe(true)
    expect(isWithinNextDays('2026-11-06', 7, morning)).toBe(true)
    expect(isWithinNextDays('2026-11-07', 7, morning)).toBe(false)
    // Late evening must not roll into the next UTC day.
    expect(calendarDaysFromToday('2026-10-30', new Date(2026, 9, 30, 22, 30, 0))).toBe(0)
  })
})
