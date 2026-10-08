import type { CalendarEvent } from '@/lib/meetingCalendar'
import type { MeetingChannel, MeetingRecord, MeetingStatus, TranscriptLine } from '@/types/meetings'

// Intentionally strips ASCII control characters from untrusted meeting text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g // eslint-disable-line no-control-regex

export const MEETING_CHANNELS: readonly MeetingChannel[] = [
  'teams',
  'zoom',
  'skype',
  'meet',
  'webex',
  'phone',
  'landline',
  'facecall',
] as const

export const MEETING_STATUSES: readonly MeetingStatus[] = [
  'scheduled',
  'live',
  'completed',
  'cancelled',
] as const

export const FIELD_LIMITS = {
  title: 200,
  name: 160,
  company: 160,
  email: 180,
  phone: 24,
  project: 160,
  notes: 4000,
  tags: 120,
  joinUrl: 500,
  transcript: 100_000,
  transcriptJson: 150_000,
  summary: 4000,
  speaker: 80,
  lineText: 2000,
  calendarTitle: 200,
  calendarNotes: 4000,
  maxTranscriptLines: 2000,
  maxCalendarEvents: 400,
} as const

const CHANNEL_HOSTS: Record<MeetingChannel, string[]> = {
  teams: ['teams.microsoft.com', 'teams.live.com'],
  zoom: ['zoom.us'],
  skype: ['web.skype.com', 'join.skype.com'],
  meet: ['meet.google.com'],
  webex: ['webex.com'],
  phone: [],
  landline: [],
  facecall: [],
}

export function sanitizeText(input: unknown, max: number): string {
  if (typeof input !== 'string') return ''
  return input.replace(CONTROL_CHARS, '').replace(/[<>]/g, '').trim().slice(0, max)
}

export function sanitizeMultiline(input: unknown, max: number): string {
  if (typeof input !== 'string') return ''
  return input.replace(CONTROL_CHARS, '').replace(/[<>]/g, '').slice(0, max)
}

export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.replace(/[^\d+*#()\-\s]/g, '').trim().slice(0, FIELD_LIMITS.phone)
}

export function sanitizeEmail(input: unknown): string {
  const value = sanitizeText(input, FIELD_LIMITS.email)
  if (!value) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return ''
  return value.toLowerCase()
}

export function isMeetingChannel(value: unknown): value is MeetingChannel {
  return typeof value === 'string' && (MEETING_CHANNELS as readonly string[]).includes(value)
}

export function isMeetingStatus(value: unknown): value is MeetingStatus {
  return typeof value === 'string' && (MEETING_STATUSES as readonly string[]).includes(value)
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}

export function isClockTime(value: string): boolean {
  return value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function hostAllowed(hostname: string, allowed: string[]): boolean {
  const host = hostname.toLowerCase()
  return allowed.some((base) => host === base || host.endsWith(`.${base}`))
}

export function isAllowedHttpsJoinUrl(raw: string, channel: MeetingChannel): boolean {
  const allowed = CHANNEL_HOSTS[channel]
  if (!allowed.length) return false
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    if (url.port && url.port !== '443') return false
    return hostAllowed(url.hostname, allowed)
  } catch {
    return false
  }
}

export function isAllowedTelUrl(raw: string): boolean {
  return /^tel:\+?[0-9*#]{0,20}$/.test(raw)
}

export function isAllowedSkypeUrl(raw: string): boolean {
  return /^skype:[a-zA-Z0-9._-]{1,64}(\?call)?$/.test(raw) || raw === 'https://web.skype.com/'
}

export function isDangerousJoinInput(raw: string): boolean {
  return /^(javascript|data|vbscript|file|blob):/i.test(raw.trim())
}

export function isAllowedJoinUrl(raw: string, channel?: MeetingChannel): boolean {
  if (!raw || raw.length > FIELD_LIMITS.joinUrl) return false
  if (raw === '#' || raw === '#facecall') return true
  if (raw.startsWith('tel:')) return isAllowedTelUrl(raw)
  if (raw.startsWith('skype:')) return isAllowedSkypeUrl(raw)
  if (channel) return isAllowedHttpsJoinUrl(raw, channel)
  return MEETING_CHANNELS.some((ch) => isAllowedHttpsJoinUrl(raw, ch))
}

export function sanitizeJoinUrl(raw: unknown, channel: MeetingChannel): string {
  if (typeof raw !== 'string') return ''
  const value = raw.trim().slice(0, FIELD_LIMITS.joinUrl)
  if (isAllowedJoinUrl(value, channel)) return value
  return ''
}

export function parseTranscriptLines(raw: unknown): TranscriptLine[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    if (raw.length > FIELD_LIMITS.transcriptJson) return []
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const out: TranscriptLine[] = []
  for (const item of parsed.slice(0, FIELD_LIMITS.maxTranscriptLines)) {
    if (typeof item !== 'object' || item == null) continue
    const row = item as Record<string, unknown>
    const id = sanitizeText(row.id, 80)
    const speaker = sanitizeText(row.speaker, FIELD_LIMITS.speaker)
    const text = sanitizeMultiline(row.text, FIELD_LIMITS.lineText).trim()
    const at = typeof row.at === 'string' ? row.at.slice(0, 40) : ''
    if (!id || !text) continue
    out.push({
      id,
      speaker: speaker || 'Speaker',
      text,
      at: at && !Number.isNaN(Date.parse(at)) ? at : new Date().toISOString(),
    })
  }
  return out
}

export function sanitizeCalendarEvent(value: unknown): CalendarEvent | null {
  if (typeof value !== 'object' || value == null) return null
  const row = value as Record<string, unknown>
  const id = sanitizeText(row.id, 80)
  const date = typeof row.date === 'string' ? row.date.trim() : ''
  const time = typeof row.time === 'string' ? row.time.trim() : ''
  if (!id || !isIsoDate(date) || !isClockTime(time)) return null
  return {
    id,
    date,
    time,
    title: sanitizeText(row.title, FIELD_LIMITS.calendarTitle) || 'Meeting note',
    notes: sanitizeMultiline(row.notes, FIELD_LIMITS.calendarNotes),
    remind: row.remind !== false,
  }
}

export function sanitizeCalendarEvents(value: unknown): CalendarEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, FIELD_LIMITS.maxCalendarEvents)
    .map(sanitizeCalendarEvent)
    .filter((event): event is CalendarEvent => event != null)
}

export function sanitizeMeetingPatch(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if ('title' in body) out.title = sanitizeText(body.title, FIELD_LIMITS.title) || 'Meeting'
  if ('channel' in body) {
    out.channel = isMeetingChannel(body.channel) ? body.channel : 'facecall'
  }
  if ('status' in body) {
    out.status = isMeetingStatus(body.status) ? body.status : 'scheduled'
  }
  if ('direction' in body) {
    const dir = body.direction
    out.direction = dir === 'outbound' || dir === 'inbound' || dir === 'conference' ? dir : 'conference'
  }
  if ('startedAt' in body) out.startedAt = sanitizeText(body.startedAt, 40)
  if ('endedAt' in body) out.endedAt = body.endedAt == null ? null : sanitizeText(body.endedAt, 40)
  if ('durationSeconds' in body) {
    const n = Number(body.durationSeconds)
    out.durationSeconds = Number.isFinite(n) ? Math.max(0, Math.min(Math.floor(n), 86_400 * 12)) : 0
  }
  if ('hostName' in body) out.hostName = sanitizeText(body.hostName, FIELD_LIMITS.name)
  if ('participantName' in body) out.participantName = sanitizeText(body.participantName, FIELD_LIMITS.name)
  if ('participantCompany' in body) {
    out.participantCompany = sanitizeText(body.participantCompany, FIELD_LIMITS.company)
  }
  if ('participantEmail' in body) out.participantEmail = sanitizeEmail(body.participantEmail)
  if ('participantPhone' in body) out.participantPhone = sanitizePhone(body.participantPhone)
  if ('joinUrl' in body) {
    const channel = isMeetingChannel(out.channel) ? out.channel : isMeetingChannel(body.channel) ? body.channel : undefined
    const raw = typeof body.joinUrl === 'string' ? body.joinUrl.trim() : ''
    out.joinUrl = channel ? sanitizeJoinUrl(raw, channel) : isAllowedJoinUrl(raw) ? raw.slice(0, FIELD_LIMITS.joinUrl) : ''
  }
  if ('dialedNumber' in body) out.dialedNumber = sanitizePhone(body.dialedNumber).replace(/[^\d+]/g, '')
  if ('opportunityId' in body) {
    out.opportunityId =
      body.opportunityId == null || body.opportunityId === ''
        ? null
        : sanitizeText(body.opportunityId, 80)
  }
  if ('projectName' in body) out.projectName = sanitizeText(body.projectName, FIELD_LIMITS.project)
  if ('transcript' in body) out.transcript = sanitizeMultiline(body.transcript, FIELD_LIMITS.transcript)
  if ('transcriptLinesJson' in body) {
    const lines = parseTranscriptLines(body.transcriptLinesJson)
    out.transcriptLinesJson = JSON.stringify(lines)
  }
  if ('summary' in body) out.summary = sanitizeMultiline(body.summary, FIELD_LIMITS.summary)
  if ('customerNotes' in body) out.customerNotes = sanitizeMultiline(body.customerNotes, FIELD_LIMITS.notes)
  if ('tags' in body) out.tags = sanitizeText(body.tags, FIELD_LIMITS.tags)
  if ('recordingEnabled' in body) out.recordingEnabled = Boolean(body.recordingEnabled)
  return out
}

export function sanitizeMeetingRecord(record: Partial<MeetingRecord>): Partial<MeetingRecord> {
  return sanitizeMeetingPatch(record as Record<string, unknown>) as Partial<MeetingRecord>
}

/** Open only allowlisted join targets. Returns false when blocked. */
export function safeOpenJoinUrl(url: string, channel: MeetingChannel, target: '_blank' | '_self' = '_blank'): boolean {
  if (!isAllowedJoinUrl(url, channel)) return false
  if (target === '_self') {
    window.location.assign(url)
    return true
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
