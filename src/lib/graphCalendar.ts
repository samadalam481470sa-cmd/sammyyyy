/**
 * Outlook calendar through Microsoft Graph, for the signed-in Microsoft account.
 * One store feeds both Email > Calendar and Meetings, so events are never kept twice.
 *
 * Permissions: Calendars.ReadWrite (delegated) is already part of the app's Outlook sign-in.
 * Nothing here asks for a password, holds a secret, or bypasses tenant rules. If Microsoft
 * refuses a call, the caller gets a plain explanation and nothing is saved locally.
 */

export type MeetingPlatform = 'Teams' | 'Zoom' | 'Google Meet' | 'Webex' | 'Other link'

export interface CalendarPerson {
  name: string
  email: string
}

export interface CalendarAttendee extends CalendarPerson {
  type: 'required' | 'optional' | 'resource'
  response: string
}

export interface OutlookEvent {
  /** Graph event ID. */
  id: string
  subject: string
  /** UTC instants (ISO). All-day events start at local midnight of their date. */
  start: string
  end: string
  isAllDay: boolean
  location: string
  organizer: CalendarPerson | null
  attendees: CalendarAttendee[]
  isOnlineMeeting: boolean
  joinUrl: string
  platform: MeetingPlatform | null
  webLink: string
  bodyPreview: string
  isCancelled: boolean
}

interface GraphDateTime {
  dateTime?: string
  timeZone?: string
}

interface GraphEventRow {
  id?: string
  subject?: string
  start?: GraphDateTime
  end?: GraphDateTime
  isAllDay?: boolean
  isCancelled?: boolean
  location?: { displayName?: string }
  organizer?: { emailAddress?: { name?: string; address?: string } }
  attendees?: Array<{
    type?: string
    status?: { response?: string }
    emailAddress?: { name?: string; address?: string }
  }>
  isOnlineMeeting?: boolean
  onlineMeeting?: { joinUrl?: string } | null
  onlineMeetingUrl?: string | null
  webLink?: string
  bodyPreview?: string
}

const GRAPH = 'https://graph.microsoft.com/v1.0'
const SELECT =
  'id,subject,start,end,isAllDay,isCancelled,location,organizer,attendees,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,webLink,bodyPreview'

/** Graph returns "2026-10-30T15:00:00.0000000" with a separate zone; the list asks for UTC. */
function utcIso(value: GraphDateTime | undefined): string | null {
  const raw = value?.dateTime?.trim()
  if (!raw) return null
  const zone = (value?.timeZone ?? 'UTC').toUpperCase()
  const base = raw.replace(/(\.\d{3})\d*$/, '$1')
  const iso = zone === 'UTC' || zone === 'GMT' ? `${base.replace(/Z$/, '')}Z` : base
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** All-day events are dates, not instants: keep them on their calendar day in local time. */
function allDayLocal(value: GraphDateTime | undefined): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.dateTime ?? '')
  if (!day) return null
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).toISOString()
}

const SAFE_HOSTS: Array<[RegExp, MeetingPlatform]> = [
  [/(^|\.)teams\.microsoft\.com$|(^|\.)teams\.live\.com$/i, 'Teams'],
  [/(^|\.)zoom\.us$|(^|\.)zoomgov\.com$/i, 'Zoom'],
  [/(^|\.)meet\.google\.com$/i, 'Google Meet'],
  [/(^|\.)webex\.com$/i, 'Webex'],
]

/** Only https links are kept; the platform comes from the link's host. */
export function meetingLinkInfo(url: string | null | undefined): { url: string; platform: MeetingPlatform } | null {
  const raw = url?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return null
    const platform = SAFE_HOSTS.find(([pattern]) => pattern.test(parsed.hostname))?.[1] ?? 'Other link'
    return { url: parsed.href, platform }
  } catch {
    return null
  }
}

function findLinkInText(text: string | undefined): string | null {
  const match = /https:\/\/[^\s<>"')]+/i.exec(text ?? '')
  if (!match) return null
  const info = meetingLinkInfo(match[0])
  return info && info.platform !== 'Other link' ? info.url : null
}

export function parseGraphEvent(row: GraphEventRow): OutlookEvent | null {
  if (!row.id) return null
  const isAllDay = Boolean(row.isAllDay)
  const start = isAllDay ? allDayLocal(row.start) : utcIso(row.start)
  const end = isAllDay ? allDayLocal(row.end) : utcIso(row.end)
  if (!start) return null
  const joinRaw = row.onlineMeeting?.joinUrl || row.onlineMeetingUrl || findLinkInText(row.bodyPreview) || ''
  const link = meetingLinkInfo(joinRaw)
  const organizer = row.organizer?.emailAddress
  return {
    id: row.id,
    subject: row.subject?.trim() || '(no title)',
    start,
    end: end ?? start,
    isAllDay,
    location: row.location?.displayName?.trim() ?? '',
    organizer: organizer?.address || organizer?.name ? { name: organizer?.name ?? '', email: organizer?.address ?? '' } : null,
    attendees: (row.attendees ?? [])
      .filter((a) => a.emailAddress?.address || a.emailAddress?.name)
      .map((a) => ({
        name: a.emailAddress?.name ?? '',
        email: a.emailAddress?.address ?? '',
        type: a.type === 'optional' || a.type === 'resource' ? a.type : 'required',
        response: a.status?.response ?? 'none',
      })),
    isOnlineMeeting: Boolean(row.isOnlineMeeting),
    joinUrl: link?.url ?? '',
    platform: link?.platform ?? (row.isOnlineMeeting ? 'Teams' : null),
    webLink: meetingLinkInfo(row.webLink)?.url ?? '',
    bodyPreview: row.bodyPreview ?? '',
    isCancelled: Boolean(row.isCancelled),
  }
}

export type CalendarErrorKind = 'not_connected' | 'consent' | 'forbidden' | 'not_found' | 'throttled' | 'network' | 'other'

export class CalendarError extends Error {
  kind: CalendarErrorKind
  status: number
  constructor(kind: CalendarErrorKind, message: string, status = 0) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

/** Turns a Graph refusal into words a person can act on. */
export function calendarErrorFor(status: number, graphCode = '', graphMessage = ''): CalendarError {
  const detail = graphMessage ? ` Microsoft said: ${graphMessage}` : ''
  if (status === 401) {
    return new CalendarError('consent', `Microsoft needs you to sign in again before the calendar can be used. Choose "Connect Outlook" and approve calendar access.${detail}`, status)
  }
  if (status === 403 || /consent|AccessDenied|Authorization_RequestDenied|ErrorAccessDenied/i.test(graphCode)) {
    return new CalendarError(
      'forbidden',
      `This Microsoft account is not allowed to use the calendar here. If it is a work account, your Microsoft 365 admin may need to approve calendar access (Calendars.ReadWrite) for this app.${detail}`,
      status,
    )
  }
  if (status === 404 || /MailboxNotEnabled|ErrorItemNotFound/i.test(graphCode)) {
    return new CalendarError('not_found', `This Microsoft account has no Outlook calendar that Graph can reach.${detail}`, status)
  }
  if (status === 429 || status === 503) {
    return new CalendarError('throttled', 'Microsoft is busy right now. Try again in a minute.', status)
  }
  return new CalendarError('other', `Outlook did not complete the request (${status || 'no response'}).${detail}`, status)
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function readGraphError(res: Response): Promise<CalendarError> {
  let code = ''
  let message = ''
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    code = body.error?.code ?? ''
    message = body.error?.message ?? ''
  } catch {
    // no JSON body
  }
  return calendarErrorFor(res.status, code, message)
}

/** All events between two instants, following Graph paging (at most 500 events). */
export async function listCalendarRange(
  token: string,
  from: Date,
  to: Date,
  fetchImpl: FetchLike = fetch,
): Promise<OutlookEvent[]> {
  let url: string | null =
    `${GRAPH}/me/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}` +
    `&endDateTime=${encodeURIComponent(to.toISOString())}&$top=100&$orderby=start/dateTime&$select=${SELECT}`
  const out: OutlookEvent[] = []
  for (let page = 0; url && page < 5; page += 1) {
    let res: Response | null = null
    // Microsoft throttles bursts (429/503). Wait as told (Retry-After, at most 10 s) and try up to 3 times.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } })
      } catch {
        throw new CalendarError('network', 'The calendar could not be reached. Check the connection and try again.')
      }
      if (res.status !== 429 && res.status !== 503) break
      const wait = Math.min(10, Number(res.headers.get('Retry-After')) || 2 ** attempt)
      if (attempt < 2) await new Promise((r) => setTimeout(r, wait * 1000))
    }
    if (!res) throw new CalendarError('network', 'The calendar could not be reached.')
    if (!res.ok) throw await readGraphError(res)
    const json = (await res.json()) as { value?: GraphEventRow[]; '@odata.nextLink'?: string }
    for (const row of json.value ?? []) {
      const event = parseGraphEvent(row)
      if (event) out.push(event)
    }
    url = json['@odata.nextLink'] ?? null
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

export interface NewCalendarEvent {
  subject: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm, ignored for all-day events */
  startTime: string
  endTime: string
  /** All-day events can span to this date (inclusive). Defaults to `date`. */
  endDate?: string
  allDay: boolean
  /** IANA zone the times are written in, e.g. America/Chicago. */
  timeZone: string
  location: string
  attendees: string[]
  teams: boolean
  description: string
}

/** Wall-clock time in a named zone -> the UTC instant, without a date library. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return asUtc - instant
  }
  let instant = guess - offsetAt(guess)
  instant = guess - offsetAt(instant)
  return new Date(instant)
}

export const EMAIL_PATTERN = /^[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[^\s@<>(),;:]{2,}$/

export function validateNewEvent(input: NewCalendarEvent): string | null {
  if (!input.subject.trim()) return 'Enter a title.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Choose a date.'
  if (!input.timeZone.trim()) return 'Choose a time zone.'
  if (!input.allDay) {
    if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) return 'Choose a start and end time.'
    const start = zonedTimeToUtc(input.date, input.startTime, input.timeZone)
    const end = zonedTimeToUtc(input.endDate || input.date, input.endTime, input.timeZone)
    if (end.getTime() <= start.getTime()) return 'The end time must be after the start time.'
  } else if (input.endDate && input.endDate < input.date) {
    return 'The end date cannot be before the start date.'
  }
  const bad = input.attendees.filter((a) => !EMAIL_PATTERN.test(a))
  if (bad.length) return `Check these attendee addresses: ${bad.join(', ')}`
  return null
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

/** Graph event body. Timed events are sent as UTC instants computed from the chosen zone. */
export function graphNewEventBody(input: NewCalendarEvent): Record<string, unknown> {
  const attendees = input.attendees.map((address) => ({ emailAddress: { address }, type: 'required' }))
  const base: Record<string, unknown> = {
    subject: input.subject.trim(),
    body: { contentType: 'Text', content: input.description },
    ...(input.location.trim() ? { location: { displayName: input.location.trim() } } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(input.teams ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' } : {}),
  }
  if (input.allDay) {
    return {
      ...base,
      isAllDay: true,
      start: { dateTime: `${input.date}T00:00:00`, timeZone: input.timeZone },
      end: { dateTime: `${nextDay(input.endDate || input.date)}T00:00:00`, timeZone: input.timeZone },
    }
  }
  const start = zonedTimeToUtc(input.date, input.startTime, input.timeZone)
  const end = zonedTimeToUtc(input.endDate || input.date, input.endTime, input.timeZone)
  return {
    ...base,
    start: { dateTime: start.toISOString().slice(0, 19), timeZone: 'UTC' },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: 'UTC' },
  }
}

/** Creates the event in Outlook. Throws CalendarError; returns only what Graph confirmed. */
export async function createCalendarEvent(
  token: string,
  input: NewCalendarEvent,
  fetchImpl: FetchLike = fetch,
): Promise<OutlookEvent> {
  const problem = validateNewEvent(input)
  if (problem) throw new CalendarError('other', problem)
  let res: Response
  try {
    res = await fetchImpl(`${GRAPH}/me/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"' },
      body: JSON.stringify(graphNewEventBody(input)),
    })
  } catch {
    throw new CalendarError('network', 'The event was not created because Outlook could not be reached.')
  }
  if (!res.ok) throw await readGraphError(res)
  const created = parseGraphEvent((await res.json()) as GraphEventRow)
  if (!created) throw new CalendarError('other', 'Outlook answered without an event. Check Outlook before trying again.')
  return created
}

/** Web Outlook calendar for this kind of account, for the "open in Outlook" fallback. */
export function outlookCalendarWebUrl(personal: boolean): string {
  return personal ? 'https://outlook.live.com/calendar/' : 'https://outlook.office.com/calendar/'
}
