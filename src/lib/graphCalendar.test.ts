import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CalendarError,
  calendarErrorFor,
  createCalendarEvent,
  graphNewEventBody,
  listCalendarRange,
  meetingLinkInfo,
  parseGraphEvent,
  validateNewEvent,
  zonedTimeToUtc,
  type NewCalendarEvent,
} from './graphCalendar'
import { addConfirmedEvent, readCalendarCache, replaceCalendarRange } from './calendarStore'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

const draft: NewCalendarEvent = {
  subject: 'Diligence check-in',
  date: '2026-11-03',
  startTime: '14:00',
  endTime: '14:30',
  allDay: false,
  timeZone: 'America/Chicago',
  location: 'Teams',
  attendees: ['ada@example.com'],
  teams: true,
  description: 'Agenda',
}

describe('Outlook calendar', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

  it('parses Graph events with organizer, attendees and a Teams link', () => {
    const event = parseGraphEvent({
      id: 'AAMk1',
      subject: 'Project AQ sync',
      start: { dateTime: '2026-11-03T20:00:00.0000000', timeZone: 'UTC' },
      end: { dateTime: '2026-11-03T20:30:00.0000000', timeZone: 'UTC' },
      organizer: { emailAddress: { name: 'Mary S', address: 'mary@example.com' } },
      attendees: [{ type: 'required', status: { response: 'accepted' }, emailAddress: { name: 'Ada', address: 'ada@example.com' } }],
      isOnlineMeeting: true,
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' },
    })!
    expect(event.start).toBe('2026-11-03T20:00:00.000Z')
    expect(event.organizer).toEqual({ name: 'Mary S', email: 'mary@example.com' })
    expect(event.attendees[0]).toMatchObject({ name: 'Ada', response: 'accepted' })
    expect(event.platform).toBe('Teams')
  })

  it('keeps only https meeting links and names the platform', () => {
    expect(meetingLinkInfo('https://us02web.zoom.us/j/1')?.platform).toBe('Zoom')
    expect(meetingLinkInfo('http://teams.microsoft.com/x')).toBeNull()
    expect(meetingLinkInfo('javascript:alert(1)')).toBeNull()
  })

  it('converts wall-clock time in the chosen zone to UTC, including across DST', () => {
    expect(zonedTimeToUtc('2026-11-03', '14:00', 'America/Chicago').toISOString()).toBe('2026-11-03T20:00:00.000Z')
    expect(zonedTimeToUtc('2026-10-30', '14:00', 'America/Chicago').toISOString()).toBe('2026-10-30T19:00:00.000Z')
    expect(zonedTimeToUtc('2026-11-03', '09:00', 'Asia/Tokyo').toISOString()).toBe('2026-11-03T00:00:00.000Z')
  })

  it('builds a Graph body and validates input', () => {
    const body = graphNewEventBody(draft)
    expect(body).toMatchObject({
      subject: 'Diligence check-in',
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      start: { dateTime: '2026-11-03T20:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-11-03T20:30:00', timeZone: 'UTC' },
      attendees: [{ emailAddress: { address: 'ada@example.com' }, type: 'required' }],
    })
    expect(validateNewEvent({ ...draft, endTime: '13:00' })).toMatch(/end time/)
    expect(validateNewEvent({ ...draft, attendees: ['not-an-email'] })).toMatch(/not-an-email/)
    expect(graphNewEventBody({ ...draft, allDay: true })).toMatchObject({
      isAllDay: true,
      start: { dateTime: '2026-11-03T00:00:00' },
      end: { dateTime: '2026-11-04T00:00:00' },
    })
  })

  it('explains consent and permission refusals', () => {
    expect(calendarErrorFor(401).kind).toBe('consent')
    expect(calendarErrorFor(403, 'ErrorAccessDenied').message).toMatch(/admin may need to approve/)
    expect(calendarErrorFor(429).kind).toBe('throttled')
  })

  it('stores nothing when Graph refuses the new event', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } }), { status: 403 }))
    await expect(createCalendarEvent('t', draft, fetchImpl)).rejects.toBeInstanceOf(CalendarError)
    expect(readCalendarCache('owner').events).toHaveLength(0)
  })

  it('returns only what Graph confirmed and follows paging when listing', async () => {
    const created = await createCalendarEvent('t', draft, async () =>
      new Response(JSON.stringify({ id: 'new1', subject: 'Diligence check-in', start: { dateTime: '2026-11-03T20:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-11-03T20:30:00', timeZone: 'UTC' } }), { status: 201 }),
    )
    addConfirmedEvent('owner', created)
    expect(readCalendarCache('owner').events.map((e) => e.id)).toEqual(['new1'])
    const pages = [
      { value: [{ id: 'a', start: { dateTime: '2026-11-01T15:00:00', timeZone: 'UTC' } }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next' },
      { value: [{ id: 'b', start: { dateTime: '2026-11-02T15:00:00', timeZone: 'UTC' } }] },
    ]
    const list = await listCalendarRange('t', new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'), async () => new Response(JSON.stringify(pages.shift())))
    expect(list.map((e) => e.id)).toEqual(['a', 'b'])
    const merged = replaceCalendarRange('owner', new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'), list)
    // The range refresh is authoritative: an event Graph no longer returns is dropped.
    expect(merged.map((e) => e.id)).toEqual(['a', 'b'])
  })
})
