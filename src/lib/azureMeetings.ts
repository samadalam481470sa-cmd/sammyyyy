import { getGraphAccessToken } from '@/auth/msal'
import { todayDateInput } from '@/lib/calendarDate'

export const AZURE_MEETING_SCOPES = ['User.Read', 'Calendars.ReadWrite', 'OnlineMeetings.ReadWrite']

const TEAMS_HOME = 'https://teams.microsoft.com/'

export interface AzureMeetingResult {
  joinUrl: string
  cloud: boolean
  detail: string
}

export interface OutlookSyncResult {
  synced: boolean
  detail: string
}

interface FetchResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponse>

export function clientFacingTeamsHome(): string {
  return TEAMS_HOME
}

export function readGraphJoinUrl(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const row = body as { joinWebUrl?: unknown; onlineMeeting?: { joinUrl?: unknown } }
  if (typeof row.joinWebUrl === 'string' && row.joinWebUrl.startsWith('https://')) return row.joinWebUrl
  const join = row.onlineMeeting?.joinUrl
  if (typeof join === 'string' && join.startsWith('https://')) return join
  return ''
}

function stamp(date: string, time: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  // The picked date and time are the user's local wall clock; Graph receives the true UTC instant.
  const start = new Date(year, month - 1, day, hour, minute)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const fmt = (value: Date) => value.toISOString().slice(0, 19)
  return { start: fmt(start), end: fmt(end) }
}

/** Outlook calendar body. Timed notes also request a Teams meeting on the event. */
export function outlookEventBody(input: {
  title: string
  date: string
  time: string
  notes: string
  attendeeEmail?: string
  attendeeName?: string
}): Record<string, unknown> | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null
  const subject = input.title.trim() || 'Meeting'
  const body = { contentType: 'Text', content: input.notes || '' }
  const attendees = input.attendeeEmail?.includes('@')
    ? [
        {
          emailAddress: { address: input.attendeeEmail.trim(), name: input.attendeeName?.trim() || input.attendeeEmail.trim() },
          type: 'required',
        },
      ]
    : undefined
  if (!input.time) {
    const [year, month, day] = input.date.split('-').map(Number)
    const endDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
    return {
      subject,
      isAllDay: true,
      showAs: 'free',
      body,
      ...(attendees ? { attendees } : {}),
      start: { dateTime: `${input.date}T00:00:00`, timeZone: 'UTC' },
      end: { dateTime: `${endDate}T00:00:00`, timeZone: 'UTC' },
    }
  }
  const when = stamp(input.date, input.time)
  if (!when) return null
  return {
    subject,
    body,
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    ...(attendees ? { attendees } : {}),
    start: { dateTime: when.start, timeZone: 'UTC' },
    end: { dateTime: when.end, timeZone: 'UTC' },
  }
}

async function graphPost(
  fetchImpl: FetchLike,
  token: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<unknown | null> {
  const res = await fetchImpl(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return null
  return res.json()
}

export async function createAzureTeamsMeeting(
  input: { subject: string; attendeeEmail?: string; attendeeName?: string },
  deps?: { token?: string | null; fetchImpl?: FetchLike; now?: Date },
): Promise<AzureMeetingResult> {
  const fallback: AzureMeetingResult = {
    joinUrl: TEAMS_HOME,
    cloud: false,
    detail: 'Microsoft Teams is open. Sign in there with the same account if Azure did not return a join link.',
  }
  const token = deps?.token === undefined ? await getGraphAccessToken(AZURE_MEETING_SCOPES) : deps.token
  if (!token) return fallback
  const fetchImpl = deps?.fetchImpl ?? fetch
  const now = deps?.now ?? new Date()
  const end = new Date(now.getTime() + 30 * 60 * 1000)
  const date = todayDateInput(now)
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const eventBody = outlookEventBody({
    title: input.subject,
    date,
    time,
    notes: 'Created from Newport Specialty Partners meetings.',
    attendeeEmail: input.attendeeEmail,
    attendeeName: input.attendeeName,
  })
  try {
    if (eventBody) {
      const created = await graphPost(fetchImpl, token, '/me/events', eventBody)
      const joinUrl = readGraphJoinUrl(created)
      if (joinUrl) {
        return { joinUrl, cloud: true, detail: 'Teams meeting is on your Microsoft 365 calendar.' }
      }
    }
    const online = await graphPost(fetchImpl, token, '/me/onlineMeetings', {
      subject: input.subject.trim() || 'Newport meeting',
      startDateTime: now.toISOString(),
      endDateTime: end.toISOString(),
    })
    const joinUrl = readGraphJoinUrl(online)
    if (joinUrl) {
      return { joinUrl, cloud: true, detail: 'Teams meeting created in Microsoft cloud.' }
    }
  } catch {
    return fallback
  }
  return fallback
}

export async function syncCalendarToOutlook(input: {
  title: string
  date: string
  time: string
  notes: string
}): Promise<OutlookSyncResult> {
  const payload = outlookEventBody(input)
  if (!payload) return { synced: false, detail: 'Saved in this browser.' }
  const token = await getGraphAccessToken(AZURE_MEETING_SCOPES)
  if (!token) return { synced: false, detail: 'Saved on this key. Sign in with Microsoft to copy it to Outlook.' }
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { synced: false, detail: 'Saved on this key. Outlook did not accept the copy.' }
    return { synced: true, detail: 'Saved here and copied to your Outlook calendar.' }
  } catch {
    return { synced: false, detail: 'Saved on this key. Outlook could not be reached.' }
  }
}
