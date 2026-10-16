import { describe, expect, it } from 'vitest'
import {
  calendarDaysFromToday,
  isOverdueDate,
  isWithinNextDays,
  shouldAutoArchive,
} from './calendarDate'

const NOW = new Date('2026-10-16T15:00:00-04:00')

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
    expect(shouldAutoArchive('2026-10-09T14:59:00Z', NOW)).toBe(true)
    expect(shouldAutoArchive('2026-10-10T15:00:00Z', NOW)).toBe(false)
  })
})
