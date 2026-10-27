import { describe, expect, it } from 'vitest'
import { meetingFromMail, meetingLabel } from './mailMeeting'
import type { MailMessage } from './outlookMailbox'

function mail(subject: string, body: string, at = '2026-10-26T15:00:00'): MailMessage {
  return { id: 'm1', folder: 'inbox', from: 'mary@newport.example', to: 'sam@utdallas.edu', subject, preview: body.slice(0, 80), body, at, read: false, demo: false }
}

describe('meeting dates from email', () => {
  it('reads an Outlook invitation When line', () => {
    const draft = meetingFromMail(
      mail('Invitation: Project Q diligence call', 'When: Tuesday, November 3, 2026 2:00 PM-3:00 PM (UTC-06:00) Central Time\nWhere: Microsoft Teams'),
    )
    expect(draft).toMatchObject({ title: 'Project Q diligence call', date: '2026-11-03', time: '14:00', found: true, meetingLike: true })
  })

  it('reads month-name dates without a year as the next one after the email', () => {
    expect(meetingFromMail(mail('Lunch', 'Can we meet Jan 5 at noon?')).date).toBe('2027-01-05')
    expect(meetingFromMail(mail('Lunch', 'Can we meet Jan 5 at noon?')).time).toBe('12:00')
    expect(meetingFromMail(mail('Check in', 'See you on Nov 12th at 9:30am')).date).toBe('2026-11-12')
    expect(meetingFromMail(mail('Check in', 'See you on Nov 12th at 9:30am')).time).toBe('09:30')
  })

  it('reads numeric, ISO, day-first, and relative dates', () => {
    expect(meetingFromMail(mail('Call 11/20', 'quick call at 3pm')).date).toBe('2026-11-20')
    expect(meetingFromMail(mail('Call 11/20', 'quick call at 3pm')).time).toBe('15:00')
    expect(meetingFromMail(mail('Review', 'Due 2026-12-01 14:30')).date).toBe('2026-12-01')
    expect(meetingFromMail(mail('Review', 'on 4 December 2026')).date).toBe('2026-12-04')
    expect(meetingFromMail(mail('Sync', 'Let us talk tomorrow at 10am')).date).toBe('2026-10-27')
    // Monday Oct 26, 2026: "next Monday" is a week out.
    expect(meetingFromMail(mail('Sync', 'next Monday works')).date).toBe('2026-11-02')
  })

  it('still offers a blank entry when the email has no date', () => {
    const draft = meetingFromMail(mail('RE: Fwd: Hello', 'Thanks for the update.'))
    expect(draft).toMatchObject({ title: 'Hello', date: '', time: '', found: false })
    expect(draft.notes).toContain('From: mary@newport.example')
  })

  it('labels a suggested meeting in plain words', () => {
    expect(meetingLabel('2026-11-03', '14:00')).toBe('Tue, Nov 3 at 2:00 PM')
    expect(meetingLabel('2026-11-03', '')).toBe('Tue, Nov 3')
  })
})
