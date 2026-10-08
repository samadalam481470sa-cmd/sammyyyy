import { describe, expect, it } from 'vitest'
import { buildJoinUrl } from './meetingLinks'
import {
  isAllowedJoinUrl,
  parseTranscriptLines,
  sanitizeCalendarEvent,
  sanitizeEmail,
  sanitizeJoinUrl,
  sanitizeMeetingPatch,
  sanitizePhone,
  sanitizeText,
} from './meetingSecurity'

describe('meetingSecurity', () => {
  it('strips markup and control characters from text', () => {
    expect(sanitizeText('Hello <script>alert(1)</script>\u0007', 200)).toBe(
      'Hello scriptalert(1)/script',
    )
  })

  it('rejects javascript and off-platform join URLs', () => {
    expect(isAllowedJoinUrl('javascript:alert(1)', 'teams')).toBe(false)
    expect(isAllowedJoinUrl('https://evil.example/phish', 'teams')).toBe(false)
    expect(isAllowedJoinUrl('https://teams.microsoft.com/l/meetup-join/abc', 'teams')).toBe(true)
    expect(sanitizeJoinUrl('https://evil.example/x', 'zoom')).toBe('')
    expect(isAllowedJoinUrl('tel:+15551212', 'phone')).toBe(true)
    expect(isAllowedJoinUrl('tel:javascript:1', 'phone')).toBe(false)
  })

  it('builds only allowlisted platform links', () => {
    expect(buildJoinUrl('teams', { meetingId: 'javascript:alert(1)' })).toBe(
      'https://teams.microsoft.com/l/meeting-join',
    )
    expect(buildJoinUrl('teams', { meetingId: 'https://evil.example/x' })).toBe(
      'https://teams.microsoft.com/l/meeting-join',
    )
    expect(buildJoinUrl('zoom', { meetingId: 'https://zoom.us/j/123456789' })).toBe(
      'https://zoom.us/j/123456789',
    )
    expect(buildJoinUrl('meet', { meetingId: 'abc-defg-hij' })).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
    expect(isAllowedJoinUrl(buildJoinUrl('phone', { phone: '5551234567' }), 'phone')).toBe(true)
  })

  it('validates email and phone', () => {
    expect(sanitizeEmail('Rob@CrossCover.DEMO')).toBe('rob@crosscover.demo')
    expect(sanitizeEmail('not-an-email')).toBe('')
    expect(sanitizePhone('(555) 201-3344; DROP TABLE')).toBe('(555) 201-3344')
  })

  it('parses only well-formed transcript lines', () => {
    const lines = parseTranscriptLines(
      JSON.stringify([
        { id: '1', speaker: 'Dennis', text: 'Hello', at: '2026-10-08T12:00:00.000Z' },
        { id: '', speaker: 'X', text: 'skip' },
        { speaker: 'Y', text: 'no id' },
      ]),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]?.speaker).toBe('Dennis')
  })

  it('rejects calendar events with invalid dates', () => {
    expect(sanitizeCalendarEvent({ id: 'a', date: '2026-13-40', title: 'X', notes: '', time: '' })).toBeNull()
    expect(sanitizeCalendarEvent({ id: 'a', date: '2026-10-08', title: '<b>Hi</b>', notes: '', time: '09:30' })?.title).toBe(
      'bHi/b',
    )
  })

  it('does not let clients stamp another owner on a meeting patch', () => {
    const patch = sanitizeMeetingPatch({
      title: 'Call',
      ownerKey: 'key:slot-9',
      channel: 'teams',
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/ok',
    })
    expect(patch).not.toHaveProperty('ownerKey')
    expect(patch.joinUrl).toBe('https://teams.microsoft.com/l/meetup-join/ok')
  })
})
