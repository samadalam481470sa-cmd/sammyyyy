import { describe, expect, it } from 'vitest'
import {
  calendarOwnerKey,
  dueCalendarEvents,
  eventsOnDate,
  monthGrid,
} from './meetingCalendar'
import { ownerKeyFromAuth } from './ownerKey'
import type { AuthUser } from '@/types'

const slot1: AuthUser = {
  id: 'user-dennis',
  email: 'dennis@newportspecialty.demo',
  name: 'Dennis',
  role: 'partner',
  initials: 'DD',
  authMethod: 'api_key',
  apiKeySlot: 1,
  apiKeyId: 'key-slot-1',
}

const slot2: AuthUser = { ...slot1, apiKeySlot: 2, apiKeyId: 'key-slot-2' }

const manager: AuthUser = {
  id: 'user-manager',
  email: 'samad@newportspecialty.demo',
  name: 'Samad',
  role: 'admin',
  initials: 'SA',
  authMethod: 'manager_key',
  isManager: true,
}

describe('meetingCalendar', () => {
  it('gives each session key its own owner', () => {
    expect(calendarOwnerKey(slot1)).toBe('key:slot-1')
    expect(calendarOwnerKey(slot2)).toBe('key:slot-2')
    expect(calendarOwnerKey(manager)).toBe('key:manager')
    expect(calendarOwnerKey(slot1)).not.toBe(calendarOwnerKey(slot2))
  })

  it('filters events for a clicked day', () => {
    const events = [
      { id: 'a', date: '2026-10-08', time: '09:00', title: 'A', notes: '', remind: true },
      { id: 'b', date: '2026-10-09', time: '', title: 'B', notes: '', remind: true },
    ]
    expect(eventsOnDate(events, '2026-10-08').map((e) => e.id)).toEqual(['a'])
  })

  it('builds a Sunday-start month grid', () => {
    const cells = monthGrid(2026, 9) // October 2026
    expect(cells.filter(Boolean).length).toBe(31)
    expect(cells[4]).toBe('2026-10-01') // Thu
  })

  it('uses the same owner key on the server as the calendar', () => {
    expect(
      ownerKeyFromAuth({
        userId: 'user-dennis',
        authMethod: 'api_key',
        apiKeySlot: 2,
      }),
    ).toBe('key:slot-2')
    expect(
      ownerKeyFromAuth({
        userId: 'user-manager',
        authMethod: 'manager_key',
        isManager: true,
      }),
    ).toBe('key:manager')
  })

  it('marks today and tomorrow as due reminders', () => {
    const now = new Date(2026, 9, 8, 12)
    const events = [
      { id: 't', date: '2026-10-08', time: '', title: 'Today', notes: '', remind: true },
      { id: 'n', date: '2026-10-10', time: '', title: 'Later', notes: '', remind: true },
    ]
    expect(dueCalendarEvents(events, now).map((e) => e.id)).toEqual(['t'])
  })
})
