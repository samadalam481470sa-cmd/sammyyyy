import { getGraphAccessToken } from '@/auth/msal'
import type { MailMessage } from '@/lib/outlookMailbox'
import type { CalendarEvent } from '@/lib/meetingCalendar'

export const OUTLOOK_SCOPES = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'Files.ReadWrite',
]

const FOLDER_PATH = {
  inbox: 'inbox',
  sent: 'sentitems',
  drafts: 'drafts',
} as const

export function graphSendBody(input: { to: string; subject: string; body: string }): Record<string, unknown> {
  return {
    message: {
      subject: input.subject || '(no subject)',
      body: { contentType: 'Text', content: input.body },
      toRecipients: input.to
        .split(/[;,]/)
        .map((address) => address.trim())
        .filter((address) => address.includes('@'))
        .map((address) => ({ emailAddress: { address } })),
    },
    saveToSentItems: true,
  }
}

interface GraphMessage {
  id?: string
  subject?: string
  bodyPreview?: string
  body?: { content?: string }
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  from?: { emailAddress?: { address?: string } }
  toRecipients?: Array<{ emailAddress?: { address?: string } }>
}

function toMail(row: GraphMessage, folder: MailMessage['folder']): MailMessage | null {
  if (!row.id) return null
  const to = (row.toRecipients ?? []).map((item) => item.emailAddress?.address).filter(Boolean).join(', ')
  return {
    id: row.id,
    folder,
    from: row.from?.emailAddress?.address || '',
    to,
    subject: row.subject || '(no subject)',
    preview: row.bodyPreview || '',
    body: row.body?.content?.replace(/<[^>]+>/g, ' ') || row.bodyPreview || '',
    at: row.receivedDateTime || row.sentDateTime || new Date().toISOString(),
    read: Boolean(row.isRead),
    demo: false,
  }
}

async function graphFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export async function outlookToken(): Promise<string | null> {
  return getGraphAccessToken(OUTLOOK_SCOPES)
}

export async function listOutlookFolder(token: string, folder: MailMessage['folder']): Promise<MailMessage[]> {
  const res = await graphFetch(
    token,
    `/me/mailFolders/${FOLDER_PATH[folder]}/messages?$top=25&$select=id,subject,bodyPreview,body,receivedDateTime,sentDateTime,isRead,from,toRecipients`,
  )
  if (!res.ok) throw new Error(`Outlook ${folder} failed (${res.status}). Add Mail.Read on the Entra app and consent.`)
  const json = (await res.json()) as { value?: GraphMessage[] }
  return (json.value ?? []).map((row) => toMail(row, folder)).filter((row): row is MailMessage => row != null)
}

export async function sendOutlookMail(token: string, input: { to: string; subject: string; body: string }): Promise<void> {
  const res = await graphFetch(token, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify(graphSendBody(input)),
  })
  if (!res.ok) throw new Error(`Outlook did not send this message (${res.status}). Mail.Send consent is required.`)
}

export async function replyOutlookMail(token: string, id: string, comment: string): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  })
  if (!res.ok) throw new Error(`Outlook did not send the reply (${res.status}).`)
}

export async function listOutlookEvents(token: string, now = new Date()): Promise<CalendarEvent[]> {
  const start = new Date(now.getTime() - 7 * 86400000).toISOString()
  const end = new Date(now.getTime() + 60 * 86400000).toISOString()
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=50&$select=id,subject,start,bodyPreview,isOnlineMeeting,onlineMeeting`,
    { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } },
  )
  if (!res.ok) return []
  const json = (await res.json()) as {
    value?: Array<{ id?: string; subject?: string; start?: { dateTime?: string }; bodyPreview?: string }>
  }
  return (json.value ?? []).flatMap((row) => {
    const stamp = row.start?.dateTime
    if (!row.id || !stamp) return []
    return [{
      id: `graph-${row.id}`,
      date: stamp.slice(0, 10),
      time: stamp.slice(11, 16),
      title: row.subject || 'Outlook event',
      notes: row.bodyPreview || '',
      remind: true,
    }]
  })
}
