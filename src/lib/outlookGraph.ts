import { connectedMailboxAddress, disconnectOutlookMailbox, getGraphAccessToken, graphTokenError } from '@/auth/msal'

export { connectedMailboxAddress, disconnectOutlookMailbox }

export { graphTokenError }
import { parseAddresses } from '@/lib/mailAddress'
import type { MailAttachment, MailFolder, MailMessage } from '@/lib/outlookMailbox'
import type { CalendarEvent } from '@/lib/meetingCalendar'

export const OUTLOOK_SCOPES = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'Files.ReadWrite',
] as const

/** Graph well-known folder names. */
export const GRAPH_WELL_KNOWN_FOLDERS: Record<MailFolder, string> = {
  inbox: 'inbox',
  sent: 'sentitems',
  drafts: 'drafts',
  junk: 'junkemail',
  deleted: 'deleteditems',
  archive: 'archive',
}

const LIST_SELECT = [
  'id',
  'subject',
  'bodyPreview',
  'receivedDateTime',
  'sentDateTime',
  'isRead',
  'from',
  'toRecipients',
  'ccRecipients',
  'hasAttachments',
].join(',')

export function folderMessagesPath(folder: MailFolder, kind: 'list' | 'delta'): string {
  const name = GRAPH_WELL_KNOWN_FOLDERS[folder]
  if (kind === 'delta') {
    return `/me/mailFolders/${name}/messages/delta?$top=25&$select=${LIST_SELECT}`
  }
  return `/me/mailFolders/${name}/messages?$top=25&$select=${LIST_SELECT}&$orderby=receivedDateTime desc`
}

function recipients(raw: string | undefined): { emailAddress: { address: string } }[] {
  return parseAddresses(raw).map((address) => ({ emailAddress: { address } }))
}

export function graphSendBody(input: {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
}): Record<string, unknown> {
  const message: Record<string, unknown> = {
    subject: input.subject.trim() || '(no subject)',
    body: { contentType: 'Text', content: input.body },
    toRecipients: recipients(input.to),
  }
  const cc = recipients(input.cc)
  const bcc = recipients(input.bcc)
  if (cc.length) message.ccRecipients = cc
  if (bcc.length) message.bccRecipients = bcc
  return { message, saveToSentItems: true }
}

export function graphReplyBody(comment: string): Record<string, unknown> {
  return { comment }
}

export function graphReplyAllBody(comment: string): Record<string, unknown> {
  return { comment }
}

export function graphForwardBody(input: {
  to: string
  cc?: string
  bcc?: string
  comment: string
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    comment: input.comment,
    toRecipients: recipients(input.to),
  }
  const cc = recipients(input.cc)
  const bcc = recipients(input.bcc)
  if (cc.length) body.ccRecipients = cc
  if (bcc.length) body.bccRecipients = bcc
  return body
}

export function graphMoveBody(destination: 'deleteditems' | 'archive'): Record<string, unknown> {
  return { destinationId: destination }
}

export function graphDraftBody(input: {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
}): Record<string, unknown> {
  const message: Record<string, unknown> = {
    subject: input.subject.trim() || '(no subject)',
    body: { contentType: 'Text', content: input.body },
    toRecipients: recipients(input.to),
  }
  const cc = recipients(input.cc)
  const bcc = recipients(input.bcc)
  if (cc.length) message.ccRecipients = cc
  if (bcc.length) message.bccRecipients = bcc
  return message
}

/** Mailbox connect uses silent token, then the Microsoft popup with no prompt override. */
export function outlookInteractiveRequest(): { scopes: readonly string[] } {
  return { scopes: OUTLOOK_SCOPES }
}

interface GraphAddress {
  emailAddress?: { address?: string }
}

interface GraphMessage {
  id?: string
  subject?: string
  bodyPreview?: string
  body?: { contentType?: string; content?: string }
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  hasAttachments?: boolean
  from?: GraphAddress
  toRecipients?: GraphAddress[]
  ccRecipients?: GraphAddress[]
  bccRecipients?: GraphAddress[]
  '@removed'?: { reason?: string }
}

interface GraphDeltaResponse {
  value?: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

function joinAddresses(rows: GraphAddress[] | undefined): string {
  return (rows ?? [])
    .map((item) => item.emailAddress?.address)
    .filter((address): address is string => Boolean(address))
    .join(', ')
}

function plainBody(content: string | undefined): string {
  if (!content) return ''
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function toMail(row: GraphMessage, folder: MailFolder): MailMessage | null {
  if (!row.id || row['@removed']) return null
  const html = row.body?.contentType?.toLowerCase() === 'html' ? row.body.content || '' : ''
  const text = html ? plainBody(html) : row.body?.content || ''
  return {
    id: row.id,
    folder,
    from: row.from?.emailAddress?.address || '',
    to: joinAddresses(row.toRecipients),
    cc: joinAddresses(row.ccRecipients) || undefined,
    bcc: joinAddresses(row.bccRecipients) || undefined,
    subject: row.subject || '(no subject)',
    preview: row.bodyPreview || text.slice(0, 140),
    body: text,
    bodyHtml: html || undefined,
    at: row.receivedDateTime || row.sentDateTime || new Date().toISOString(),
    read: Boolean(row.isRead),
    demo: false,
    hasAttachments: Boolean(row.hasAttachments),
    bodyLoaded: Boolean(row.body?.content),
  }
}

export function parseGraphDelta(
  json: GraphDeltaResponse,
  folder: MailFolder,
): { messages: MailMessage[]; removedIds: string[]; nextLink?: string; deltaLink?: string } {
  const messages: MailMessage[] = []
  const removedIds: string[] = []
  for (const row of json.value ?? []) {
    if (row['@removed']) {
      if (row.id) removedIds.push(row.id)
      continue
    }
    const mail = toMail(row, folder)
    if (mail) messages.push(mail)
  }
  return {
    messages,
    removedIds,
    nextLink: json['@odata.nextLink'],
    deltaLink: json['@odata.deltaLink'],
  }
}

async function graphFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const url = path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`
  const timeout = AbortSignal.timeout(15_000)
  return fetch(url, { ...init, headers, signal: init?.signal ?? timeout })
}

async function readError(res: Response, fallback: string): Promise<Error> {
  return new Error(`${fallback} (${res.status}).`)
}

export async function outlookToken(interactive = false, loginHint?: string): Promise<string | null> {
  // The Connect Outlook button goes to Microsoft's account picker by full-page redirect.
  return getGraphAccessToken([...OUTLOOK_SCOPES], interactive ? { interactive: true, loginHint, mode: 'redirect' } : { interactive: false })
}

export async function listOutlookFolder(token: string, folder: MailFolder): Promise<MailMessage[]> {
  const res = await graphFetch(token, folderMessagesPath(folder, 'list'))
  if (!res.ok) throw new Error(`Outlook ${folder} failed (${res.status}). Add Mail.Read on the Entra app and consent.`)
  const json = (await res.json()) as { value?: GraphMessage[] }
  return (json.value ?? []).map((row) => toMail(row, folder)).filter((row): row is MailMessage => row != null)
}

/** Older mail in one folder: the 25 messages received before `beforeIso`. */
export async function listOutlookFolderBefore(token: string, folder: MailFolder, beforeIso: string): Promise<MailMessage[]> {
  const name = GRAPH_WELL_KNOWN_FOLDERS[folder]
  const filter = encodeURIComponent(`receivedDateTime lt ${new Date(beforeIso).toISOString()}`)
  const res = await graphFetch(
    token,
    `/me/mailFolders/${name}/messages?$top=25&$select=${LIST_SELECT}&$filter=${filter}&$orderby=receivedDateTime desc`,
  )
  if (!res.ok) throw new Error(`Outlook ${folder} failed (${res.status}).`)
  const json = (await res.json()) as { value?: GraphMessage[] }
  return (json.value ?? []).map((row) => toMail(row, folder)).filter((row): row is MailMessage => row != null)
}

export interface OutlookFolderPage {
  messages: MailMessage[]
  removedIds: string[]
  /** True when this response is a full folder snapshot and missing ids in that folder can be dropped. */
  full: boolean
  deltaLink: string | null
}

export async function deltaOutlookFolder(
  token: string,
  folder: MailFolder,
  deltaLink?: string | null,
): Promise<OutlookFolderPage> {
  let url = deltaLink || folderMessagesPath(folder, 'delta')
  const messages: MailMessage[] = []
  const removedIds: string[] = []
  let finalDelta: string | null = null
  let resume: string | null = null
  let pages = 0
  while (url && pages < 4) {
    const res = await graphFetch(token, url)
    if (res.status === 410) throw new Error('delta-expired')
    if (!res.ok) throw new Error(`Outlook ${folder} failed (${res.status}). Add Mail.Read on the Entra app and consent.`)
    const json = (await res.json()) as GraphDeltaResponse
    const parsed = parseGraphDelta(json, folder)
    messages.push(...parsed.messages)
    removedIds.push(...parsed.removedIds)
    pages += 1
    if (parsed.nextLink) {
      url = parsed.nextLink
      resume = parsed.nextLink
      finalDelta = null
    } else {
      url = ''
      resume = null
      finalDelta = parsed.deltaLink ?? null
    }
  }
  const finished = !resume
  return {
    messages,
    removedIds,
    full: !deltaLink && finished,
    deltaLink: resume || finalDelta,
  }
}

export async function getOutlookMessage(token: string, id: string, folder: MailFolder): Promise<MailMessage | null> {
  const select = 'id,subject,body,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments'
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}?$select=${select}`)
  if (!res.ok) return null
  const json = (await res.json()) as GraphMessage
  const mail = toMail(json, folder)
  if (!mail) return null
  return { ...mail, bodyLoaded: true }
}

export async function listOutlookAttachments(token: string, id: string): Promise<MailAttachment[]> {
  const res = await graphFetch(
    token,
    `/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline`,
  )
  if (!res.ok) return []
  const json = (await res.json()) as {
    value?: Array<{ id?: string; name?: string; contentType?: string; size?: number; isInline?: boolean }>
  }
  return (json.value ?? [])
    .filter((row) => row.id && row.name && !row.isInline)
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      contentType: row.contentType || 'application/octet-stream',
      size: row.size || 0,
    }))
}

export async function downloadOutlookAttachment(
  token: string,
  messageId: string,
  attachment: MailAttachment,
): Promise<void> {
  const res = await graphFetch(
    token,
    `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}/$value`,
    { headers: { Accept: '*/*' } },
  )
  if (!res.ok) throw await readError(res, 'Outlook did not download this attachment')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name
  link.click()
  URL.revokeObjectURL(url)
}

export async function sendOutlookMail(
  token: string,
  input: { to: string; cc?: string; bcc?: string; subject: string; body: string },
): Promise<void> {
  const res = await graphFetch(token, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify(graphSendBody(input)),
  })
  if (!res.ok) throw new Error(`Outlook did not send this message (${res.status}). Mail.Send consent is required.`)
}

export async function replyOutlookMail(token: string, id: string, comment: string): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    body: JSON.stringify(graphReplyBody(comment)),
  })
  if (!res.ok) throw new Error(`Outlook did not send the reply (${res.status}).`)
}

export async function replyAllOutlookMail(token: string, id: string, comment: string): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/replyAll`, {
    method: 'POST',
    body: JSON.stringify(graphReplyAllBody(comment)),
  })
  if (!res.ok) throw new Error(`Outlook did not send the reply (${res.status}).`)
}

export async function forwardOutlookMail(
  token: string,
  id: string,
  input: { to: string; cc?: string; bcc?: string; comment: string },
): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/forward`, {
    method: 'POST',
    body: JSON.stringify(graphForwardBody(input)),
  })
  if (!res.ok) throw new Error(`Outlook did not forward this message (${res.status}).`)
}

export async function moveOutlookMessage(
  token: string,
  id: string,
  destination: 'deleteditems' | 'archive',
): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/move`, {
    method: 'POST',
    body: JSON.stringify(graphMoveBody(destination)),
  })
  if (!res.ok) throw new Error(`Outlook did not move this message (${res.status}).`)
}

export async function setOutlookRead(token: string, id: string, read: boolean): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead: read }),
  })
  if (!res.ok) throw new Error(`Outlook did not update this message (${res.status}).`)
}

export async function createOutlookDraft(
  token: string,
  input: { to: string; cc?: string; bcc?: string; subject: string; body: string },
): Promise<string> {
  const res = await graphFetch(token, '/me/messages', {
    method: 'POST',
    body: JSON.stringify(graphDraftBody(input)),
  })
  if (!res.ok) throw new Error(`Outlook did not save this draft (${res.status}).`)
  const json = (await res.json()) as { id?: string }
  if (!json.id) throw new Error('Outlook did not return a draft id.')
  return json.id
}

export async function updateOutlookDraft(
  token: string,
  id: string,
  input: { to: string; cc?: string; bcc?: string; subject: string; body: string },
): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(graphDraftBody(input)),
  })
  if (!res.ok) throw new Error(`Outlook did not save this draft (${res.status}).`)
}

export async function sendOutlookDraft(token: string, id: string): Promise<void> {
  const res = await graphFetch(token, `/me/messages/${encodeURIComponent(id)}/send`, { method: 'POST' })
  if (!res.ok) throw new Error(`Outlook did not send this draft (${res.status}).`)
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
