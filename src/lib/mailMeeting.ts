import type { MailMessage } from '@/lib/outlookMailbox'

/** A calendar entry suggested from an email. The user reviews it before saving. */
export interface MailMeetingDraft {
  title: string
  /** YYYY-MM-DD, or '' when no date was found in the email. */
  date: string
  /** HH:MM (24h), or '' when no time was found. */
  time: string
  notes: string
  /** True when a date was found in the subject or body. */
  found: boolean
  /** True when the email reads like a meeting, invitation, or call. */
  meetingLike: boolean
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTH_WORD = '(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*\\.?'

const MEETING_WORDS =
  /\b(meeting|meet|invitation|invite|invited|call|appointment|zoom|teams|webex|google meet|calendar|schedule[ds]?|agenda|webinar|interview|demo|sync|when:)\b/i

const SUBJECT_PREFIX =
  /^\s*((re|fw|fwd|aw|tr)\s*:\s*|(updated\s+)?invitation\s*:\s*|(accepted|declined|tentative|canceled|cancelled)\s*:\s*)+/i

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function localISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A date with no year means the next time that day comes around after the email arrived. */
function withYear(month: number, day: number, year: number | null, sent: Date): string | null {
  if (year) return isoDate(year < 100 ? 2000 + year : year, month, day)
  const sentDay = localISO(sent)
  const sameYear = isoDate(sent.getFullYear(), month, day)
  if (sameYear && sameYear >= sentDay) return sameYear
  return isoDate(sent.getFullYear() + 1, month, day)
}

interface DateHit {
  date: string
  index: number
  end: number
}

function findDate(text: string, sent: Date): DateHit | null {
  const hits: DateHit[] = []
  const add = (date: string | null, match: RegExpExecArray) => {
    if (date) hits.push({ date, index: match.index, end: match.index + match[0].length })
  }
  let match: RegExpExecArray | null

  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g
  while ((match = iso.exec(text))) add(isoDate(Number(match[1]), Number(match[2]), Number(match[3])), match)

  const monthFirst = new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'gi')
  while ((match = monthFirst.exec(text))) {
    const month = MONTHS[match[1].toLowerCase()]
    add(withYear(month, Number(match[2]), match[3] ? Number(match[3]) : null, sent), match)
  }

  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_WORD}(?:,?\\s+(\\d{4}))?`, 'gi')
  while ((match = dayFirst.exec(text))) {
    const month = MONTHS[match[2].toLowerCase()]
    add(withYear(month, Number(match[1]), match[3] ? Number(match[3]) : null, sent), match)
  }

  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g
  while ((match = numeric.exec(text))) {
    add(withYear(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null, sent), match)
  }

  const relative = /\b(today|tomorrow|(?:on|next|this)\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b/gi
  while ((match = relative.exec(text))) {
    const word = match[1].toLowerCase()
    const target = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate())
    if (word === 'tomorrow') target.setDate(target.getDate() + 1)
    else if (word !== 'today') {
      const wanted = WEEKDAYS.indexOf(match[2].toLowerCase().slice(0, 3))
      let ahead = (wanted - target.getDay() + 7) % 7
      if (ahead === 0 && word.startsWith('next')) ahead = 7
      target.setDate(target.getDate() + ahead)
    }
    add(localISO(target), match)
  }

  hits.sort((a, b) => a.index - b.index)
  return hits[0] ?? null
}

function findTime(text: string): string {
  const twelve = /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i.exec(text)
  if (twelve) {
    let hour = Number(twelve[1])
    if (hour >= 1 && hour <= 12) {
      const pm = twelve[3].toLowerCase().startsWith('p')
      if (pm && hour !== 12) hour += 12
      if (!pm && hour === 12) hour = 0
      return `${pad(hour)}:${twelve[2] ?? '00'}`
    }
  }
  const noon = /\b(noon|midday)\b/i.exec(text)
  if (noon) return '12:00'
  const military = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text)
  if (military) return `${pad(Number(military[1]))}:${military[2]}`
  return ''
}

function plain(message: MailMessage): string {
  const raw = message.body || message.preview || ''
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Suggest a calendar entry from an email: its meeting date and time when it has one. */
export function meetingFromMail(message: MailMessage, now = new Date()): MailMeetingDraft {
  const sentAt = new Date(message.at)
  const sent = Number.isNaN(sentAt.getTime()) ? now : sentAt
  const subject = message.subject || ''
  const body = plain(message)
  const title = subject.replace(SUBJECT_PREFIX, '').trim() || 'Meeting'
  const meetingLike = MEETING_WORDS.test(subject) || MEETING_WORDS.test(body)

  // The subject wins; then the body, starting at an Outlook "When:" line if there is one.
  const whenAt = body.search(/\bwhen\s*:/i)
  const sources = [subject, whenAt >= 0 ? body.slice(whenAt) : '', body]
  let date = ''
  let time = ''
  for (const source of sources) {
    if (!source) continue
    const hit = findDate(source, sent)
    if (!hit) continue
    date = hit.date
    time = findTime(source.slice(hit.end, hit.end + 80)) || findTime(source.slice(Math.max(0, hit.index - 40), hit.index))
    break
  }
  if (date && !time) time = findTime(subject) || findTime(body)

  const from = message.from ? `From: ${message.from}` : ''
  const notes = [from, `Email: ${subject || '(no subject)'}`, (message.preview || body).slice(0, 400)]
    .filter(Boolean)
    .join('\n')

  return { title, date, time, notes, found: Boolean(date), meetingLike }
}

/** Short label such as "Tue, Nov 3 at 2:00 PM" for a suggested meeting. */
export function meetingLabel(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return ''
  const when = new Date(year, month - 1, day)
  const datePart = when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (!time) return datePart
  const [hour, minute] = time.split(':').map(Number)
  const at = new Date(year, month - 1, day, hour, minute)
  return `${datePart} at ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}
