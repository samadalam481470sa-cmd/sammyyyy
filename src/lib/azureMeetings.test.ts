import { describe, expect, it } from 'vitest'
import {
  createAzureTeamsMeeting,
  outlookEventBody,
  readGraphJoinUrl,
} from './azureMeetings'

describe('Azure Teams meetings', () => {
  it('reads a Graph join link from a calendar event or an online meeting', () => {
    expect(readGraphJoinUrl({ onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' } })).toBe(
      'https://teams.microsoft.com/l/meetup-join/abc',
    )
    expect(readGraphJoinUrl({ joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/xyz' })).toMatch(/xyz/)
    expect(readGraphJoinUrl({ joinWebUrl: 'http://evil.example' })).toBe('')
  })

  it('builds an Outlook event that asks Teams to host a timed meeting', () => {
    const body = outlookEventBody({
      title: 'Diligence call',
      date: '2026-10-24',
      time: '15:00',
      notes: 'Bring the model',
      attendeeEmail: 'ada@outlook.com',
      attendeeName: 'Ada',
    })
    // 15:00 is the user's local wall clock; Graph gets the matching UTC instant.
    const start = new Date(2026, 9, 24, 15, 0).toISOString().slice(0, 19)
    const end = new Date(2026, 9, 24, 15, 30).toISOString().slice(0, 19)
    expect(body).toMatchObject({
      subject: 'Diligence call',
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
    })
  })

  it('creates the meeting from Graph and falls back to Teams when Azure has no token', async () => {
    const calls: string[] = []
    const created = await createAzureTeamsMeeting(
      { subject: 'Cloud huddle' },
      {
        token: 'token',
        now: new Date('2026-10-24T15:00:00Z'),
        fetchImpl: async (url) => {
          calls.push(url)
          if (url.endsWith('/me/events')) {
            return { ok: true, status: 201, json: async () => ({ onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/cloud' } }) }
          }
          return { ok: false, status: 403, json: async () => ({}) }
        },
      },
    )
    expect(created.cloud).toBe(true)
    expect(created.joinUrl).toContain('meetup-join/cloud')
    expect(calls[0]).toBe('https://graph.microsoft.com/v1.0/me/events')

    const fallback = await createAzureTeamsMeeting({ subject: 'Offline' }, { token: null })
    expect(fallback.cloud).toBe(false)
    expect(fallback.joinUrl).toBe('https://teams.microsoft.com/')
  })
})
