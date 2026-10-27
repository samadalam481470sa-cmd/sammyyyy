/**
 * Gmail for the CRM Email page (Google Identity Services + Gmail REST API).
 *
 * Needs a Google OAuth client ID (Web application) with the live site as an authorized
 * JavaScript origin. Set it in public/google.json ({"clientId": "…apps.googleusercontent.com"})
 * or VITE_GOOGLE_CLIENT_ID. Without it the Email page shows "Gmail is not set up yet".
 *
 * The access token lives only in this tab (sessionStorage, keyed by the CRM login) and is
 * erased at logout with the rest of the personal mail data.
 */
import type { MailAttachment, MailFolder, MailMessage, OutgoingAttachment } from '@/lib/outlookMailbox'

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
export const GMAIL_ID_PREFIX = 'gmail:'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Gmail labels (or a search) for each CRM mail folder. */
export const GMAIL_FOLDERS: Record<MailFolder, { labelIds?: string[]; q?: string; spamTrash?: boolean }> = {
  inbox: { labelIds: ['INBOX'] },
  sent: { labelIds: ['SENT'] },
  drafts: { labelIds: ['DRAFT'] },
  junk: { labelIds: ['SPAM'], spamTrash: true },
  deleted: { labelIds: ['TRASH'], spamTrash: true },
  archive: { q: '-in:inbox -in:sent -in:drafts -in:spam -in:trash -in:chats' },
}

// ── client ID ────────────────────────────────────────────────────────────────

let clientIdPromise: Promise<string> | null = null

export function gmailClientId(): Promise<string> {
  if (!clientIdPromise) {
    clientIdPromise = (async () => {
      const fromEnv = String(import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? '').trim()
      if (fromEnv) return fromEnv
      if (typeof fetch === 'undefined' || typeof document === 'undefined') return ''
      try {
        const res = await fetch(new URL('google.json', document.baseURI).href, { cache: 'no-store' })
        if (!res.ok) return ''
        const json = (await res.json()) as { clientId?: string }
        return String(json.clientId ?? '').trim()
      } catch {
        return ''
      }
    })()
  }
  return clientIdPromise
}

// ── token (this tab only, per CRM login) ─────────────────────────────────────

interface StoredToken {
  accessToken: string
  expiresAt: number
  address: string
}

function tokenKey(owner: string): string {
  return `newport_outlook_gmail_token:${owner.trim().toLowerCase()}`
}

function readToken(owner: string): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(tokenKey(owner))
    if (!raw) return null
    const row = JSON.parse(raw) as StoredToken
    if (!row.accessToken || Date.now() > row.expiresAt - 60_000) return null
    return row
  } catch {
    return null
  }
}

function writeToken(owner: string, token: StoredToken): void {
  try {
    sessionStorage.setItem(tokenKey(owner), JSON.stringify(token))
  } catch {
    // storage blocked; Gmail stays connected for this page only
  }
}

/** True when this CRM user has connected Gmail in this tab and the token is still valid. */
export function isGmailConnected(owner: string): boolean {
  return readToken(owner) != null
}

/** Gmail address connected for this CRM user, if any. */
export function gmailAddress(owner: string): string {
  return readToken(owner)?.address ?? ''
}

export function disconnectGmail(owner: string): void {
  const token = readToken(owner)
  try {
    sessionStorage.removeItem(tokenKey(owner))
  } catch {
    // ignore
  }
  const google = (window as unknown as { google?: GoogleNamespace }).google
  if (token && google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(token.accessToken, () => undefined)
}

// ── Google Identity Services ─────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; hint?: string }) => void
}
interface GoogleNamespace {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: { type?: string; message?: string }) => void
      }) => TokenClient
      revoke?: (token: string, done: () => void) => void
    }
  }
}

let gisPromise: Promise<GoogleNamespace | null> | null = null

/** Load Google's sign-in script early, so the Connect Gmail click can open Google's window at once. */
export function preloadGmail(): Promise<GoogleNamespace | null> {
  if (!gisPromise) {
    gisPromise = new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve(null)
      const existing = (window as unknown as { google?: GoogleNamespace }).google
      if (existing?.accounts?.oauth2) return resolve(existing)
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve((window as unknown as { google?: GoogleNamespace }).google ?? null)
      script.onerror = () => {
        gisPromise = null
        resolve(null)
      }
      document.head.appendChild(script)
    })
  }
  return gisPromise
}

export class GmailSetupError extends Error {}

/**
 * Open Google's window so this CRM user signs in to their own Gmail and allows mail access.
 * Call from a click. Resolves with the Gmail address.
 */
export async function connectGmail(owner: string, hint?: string): Promise<string> {
  const clientId = await gmailClientId()
  if (!clientId) {
    throw new GmailSetupError(
      'Gmail is not set up yet. Add a Google OAuth client ID to public/google.json, then connect Gmail.',
    )
  }
  const google = await preloadGmail()
  const oauth2 = google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google sign-in could not load. Check the connection and try again.')
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: resolve,
      error_callback: (error) =>
        reject(
          new Error(
            error?.type === 'popup_closed'
              ? 'The Google window was closed before Gmail was connected.'
              : error?.type === 'popup_failed_to_open'
                ? 'The browser blocked the Google window. Allow pop-ups for this site and try again.'
                : error?.message || 'Google did not connect Gmail.',
          ),
        ),
    })
    client.requestAccessToken({ prompt: '', ...(hint?.includes('@') ? { hint } : {}) })
  })
  if (!response.access_token) {
    throw new Error(
      response.error === 'access_denied'
        ? 'Gmail access was not allowed.'
        : response.error_description || response.error || 'Google did not connect Gmail.',
    )
  }
  const expiresIn = Number(response.expires_in ?? 3600)
  const profile = await gmailFetch(response.access_token, '/profile')
  const address = profile.ok ? String(((await profile.json()) as { emailAddress?: string }).emailAddress ?? '') : ''
  writeToken(owner, { accessToken: response.access_token, expiresAt: Date.now() + expiresIn * 1000, address })
  return address
}

// ── Gmail REST ───────────────────────────────────────────────────────────────

function gmailFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
}

function requireToken(owner: string): string {
  const token = readToken(owner)
  if (!token) throw new Error('Gmail is not connected. Click Connect Gmail.')
  return token.accessToken
}

async function ok(res: Response, what: string): Promise<Response> {
  if (res.ok) return res
  let detail = ''
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    // no body
  }
  throw new Error(`Gmail did not ${what} (${res.status}). ${detail}`.trim())
}

export function gmailId(raw: string): string {
  return raw.startsWith(GMAIL_ID_PREFIX) ? raw.slice(GMAIL_ID_PREFIX.length) : raw
}

export function isGmailId(id: string): boolean {
  return id.startsWith(GMAIL_ID_PREFIX)
}

interface GmailHeader {
  name: string
  value: string
}
interface GmailPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: GmailPart[]
}
interface GmailRawMessage {
  id: string
  threadId?: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: GmailPart
}

function header(part: GmailPart | undefined, name: string): string {
  const row = part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return row?.value ?? ''
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Gmail sends addresses as "Name <a@b.com>". The CRM shows the address. */
function addresses(value: string): string {
  return value
    .split(',')
    .map((part) => {
      const match = /<([^>]+)>/.exec(part)
      return (match ? match[1] : part).trim()
    })
    .filter(Boolean)
    .join(', ')
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function folderFromLabels(labels: string[] | undefined, fallback: MailFolder): MailFolder {
  const set = new Set(labels ?? [])
  if (set.has('TRASH')) return 'deleted'
  if (set.has('SPAM')) return 'junk'
  if (set.has('DRAFT')) return 'drafts'
  if (set.has('INBOX')) return 'inbox'
  if (set.has('SENT')) return 'sent'
  return fallback
}

export function toMailMessage(raw: GmailRawMessage, folder: MailFolder): MailMessage {
  const at = raw.internalDate ? new Date(Number(raw.internalDate)).toISOString() : new Date().toISOString()
  const snippet = decodeEntities(raw.snippet ?? '')
  return {
    id: `${GMAIL_ID_PREFIX}${raw.id}`,
    folder: folderFromLabels(raw.labelIds, folder),
    from: addresses(header(raw.payload, 'From')),
    to: addresses(header(raw.payload, 'To')),
    cc: addresses(header(raw.payload, 'Cc')) || undefined,
    subject: header(raw.payload, 'Subject') || '(no subject)',
    preview: snippet,
    body: snippet,
    at,
    read: !(raw.labelIds ?? []).includes('UNREAD'),
    flagged: (raw.labelIds ?? []).includes('STARRED'),
    demo: false,
    bodyLoaded: false,
  }
}

function walkParts(part: GmailPart | undefined, visit: (part: GmailPart) => void): void {
  if (!part) return
  visit(part)
  for (const child of part.parts ?? []) walkParts(child, visit)
}

/** Text, HTML, and attachments from a full Gmail message. */
export function readGmailBody(raw: GmailRawMessage): { body: string; bodyHtml?: string; attachments: MailAttachment[] } {
  let text = ''
  let html = ''
  const attachments: MailAttachment[] = []
  walkParts(raw.payload, (part) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        name: part.filename,
        contentType: part.mimeType ?? 'application/octet-stream',
        size: part.body.size ?? 0,
      })
      return
    }
    if (!part.body?.data) return
    if (part.mimeType === 'text/plain' && !text) text = decodeBase64Url(part.body.data)
    if (part.mimeType === 'text/html' && !html) html = decodeBase64Url(part.body.data)
  })
  const body = text || html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return { body: body || decodeEntities(raw.snippet ?? ''), ...(html ? { bodyHtml: html } : {}), attachments }
}

async function getMetadata(token: string, id: string): Promise<GmailRawMessage | null> {
  const res = await gmailFetch(
    token,
    `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
  )
  return res.ok ? ((await res.json()) as GmailRawMessage) : null
}

/** Newest messages in one folder. Messages already stored are not fetched again. */
export async function listGmailFolder(
  owner: string,
  folder: MailFolder,
  known: Map<string, MailMessage>,
  max = 20,
  beforeIso?: string,
): Promise<MailMessage[]> {
  const token = requireToken(owner)
  const spec = GMAIL_FOLDERS[folder]
  const params = new URLSearchParams({ maxResults: String(max) })
  for (const label of spec.labelIds ?? []) params.append('labelIds', label)
  // Older mail: Gmail search "before:" takes seconds since 1970.
  const before = beforeIso ? `before:${Math.floor(new Date(beforeIso).getTime() / 1000)}` : ''
  const q = [spec.q, before].filter(Boolean).join(' ')
  if (q) params.set('q', q)
  if (spec.spamTrash) params.set('includeSpamTrash', 'true')
  const res = await ok(await gmailFetch(token, `/messages?${params}`), `list ${folder}`)
  const ids = (((await res.json()) as { messages?: { id: string }[] }).messages ?? []).map((row) => row.id)
  const rows = await Promise.all(
    ids.map(async (id) => {
      const cached = known.get(`${GMAIL_ID_PREFIX}${id}`)
      if (cached && cached.folder === folder) return cached
      const raw = await getMetadata(token, id)
      return raw ? toMailMessage(raw, folder) : null
    }),
  )
  return rows.filter((row): row is MailMessage => row != null).map((row) => ({ ...row, folder }))
}

export async function getGmailMessage(owner: string, id: string, folder: MailFolder): Promise<MailMessage | null> {
  const token = readToken(owner)?.accessToken
  if (!token) return null
  const res = await gmailFetch(token, `/messages/${encodeURIComponent(gmailId(id))}?format=full`)
  if (!res.ok) return null
  const raw = (await res.json()) as GmailRawMessage
  const base = toMailMessage(raw, folder)
  const content = readGmailBody(raw)
  return {
    ...base,
    ...content,
    hasAttachments: content.attachments.length > 0,
    bodyLoaded: true,
  }
}

export async function downloadGmailAttachment(owner: string, messageId: string, attachment: MailAttachment): Promise<void> {
  const token = requireToken(owner)
  const res = await ok(
    await gmailFetch(token, `/messages/${encodeURIComponent(gmailId(messageId))}/attachments/${encodeURIComponent(attachment.id)}`),
    'download that file',
  )
  const data = ((await res.json()) as { data?: string }).data ?? ''
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const blob = new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: attachment.contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f]*$/.test(value) ? value : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(value)))}?=`
}

/** RFC 2822 message for Gmail's send and draft APIs. */
export function buildRawMessage(input: {
  from?: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  inReplyTo?: string
  attachments?: OutgoingAttachment[]
}): string {
  const headers = [
    ...(input.from ? [`From: ${input.from}`] : []),
    `To: ${input.to}`,
    ...(input.cc ? [`Cc: ${input.cc}`] : []),
    ...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
    `Subject: ${encodeHeader(input.subject.trim() || '(no subject)')}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`] : []),
    'MIME-Version: 1.0',
  ]
  const files = input.attachments ?? []
  if (!files.length) {
    const lines = [...headers, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', input.body]
    return encodeBase64Url(lines.join('\r\n'))
  }
  const boundary = `newport-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  const safeName = (name: string) => encodeHeader(name.replace(/["\r\n\\/]/g, '_'))
  const wrap = (base64: string) => base64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.body,
    ...files.flatMap((file) => [
      `--${boundary}`,
      `Content-Type: ${file.contentType || 'application/octet-stream'}; name="${safeName(file.name)}"`,
      `Content-Disposition: attachment; filename="${safeName(file.name)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap(file.base64),
    ]),
    `--${boundary}--`,
  ]
  return encodeBase64Url([...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ...parts].join('\r\n'))
}

async function threadInfo(token: string, id: string): Promise<{ threadId?: string; messageId?: string }> {
  const res = await gmailFetch(token, `/messages/${encodeURIComponent(gmailId(id))}?format=metadata&metadataHeaders=Message-ID`)
  if (!res.ok) return {}
  const raw = (await res.json()) as GmailRawMessage
  return { threadId: raw.threadId, messageId: header(raw.payload, 'Message-ID') || undefined }
}

/** Send from the connected Gmail. Replies and forwards stay in the original thread. */
export async function sendGmail(
  owner: string,
  input: { to: string; cc?: string; bcc?: string; subject: string; body: string; replyToId?: string; attachments?: OutgoingAttachment[] },
): Promise<void> {
  const token = requireToken(owner)
  const thread = input.replyToId && isGmailId(input.replyToId) ? await threadInfo(token, input.replyToId) : {}
  const raw = buildRawMessage({ ...input, inReplyTo: thread.messageId })
  await ok(
    await gmailFetch(token, '/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw, ...(thread.threadId ? { threadId: thread.threadId } : {}) }),
    }),
    'send the message',
  )
}

/** Save a draft in Gmail. Returns the draft's message id (prefixed). */
export async function saveGmailDraft(
  owner: string,
  input: { id?: string; to: string; cc?: string; bcc?: string; subject: string; body: string },
): Promise<string> {
  const token = requireToken(owner)
  const raw = buildRawMessage(input)
  const draftId = input.id && isGmailId(input.id) ? await draftIdFor(token, input.id) : null
  const res = await ok(
    await gmailFetch(token, draftId ? `/drafts/${encodeURIComponent(draftId)}` : '/drafts', {
      method: draftId ? 'PUT' : 'POST',
      body: JSON.stringify({ message: { raw } }),
    }),
    'save the draft',
  )
  const json = (await res.json()) as { message?: { id?: string } }
  return `${GMAIL_ID_PREFIX}${json.message?.id ?? ''}`
}

async function draftIdFor(token: string, messageId: string): Promise<string | null> {
  const res = await gmailFetch(token, '/drafts?maxResults=100')
  if (!res.ok) return null
  const drafts = ((await res.json()) as { drafts?: { id: string; message?: { id?: string } }[] }).drafts ?? []
  return drafts.find((row) => row.message?.id === gmailId(messageId))?.id ?? null
}

export async function sendGmailDraft(owner: string, messageId: string): Promise<void> {
  const token = requireToken(owner)
  const draftId = await draftIdFor(token, messageId)
  if (!draftId) throw new Error('Gmail could not find that draft. Open it and send it again.')
  await ok(await gmailFetch(token, '/drafts/send', { method: 'POST', body: JSON.stringify({ id: draftId }) }), 'send the draft')
}

export async function moveGmail(owner: string, id: string, folder: 'deleted' | 'archive'): Promise<void> {
  const token = requireToken(owner)
  const path = `/messages/${encodeURIComponent(gmailId(id))}`
  if (folder === 'deleted') {
    await ok(await gmailFetch(token, `${path}/trash`, { method: 'POST' }), 'move it to Deleted')
    return
  }
  await ok(
    await gmailFetch(token, `${path}/modify`, { method: 'POST', body: JSON.stringify({ removeLabelIds: ['INBOX'] }) }),
    'archive it',
  )
}

export async function markGmailRead(owner: string, id: string, read: boolean): Promise<void> {
  const token = requireToken(owner)
  await ok(
    await gmailFetch(token, `/messages/${encodeURIComponent(gmailId(id))}/modify`, {
      method: 'POST',
      body: JSON.stringify(read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }),
    }),
    'update the read state',
  )
}

// ── incremental sync (Gmail history, guide p47/p49) ──────────────────────────

function cursorKey(owner: string): string {
  return `newport_outlook_gmail_cursor:${owner.trim().toLowerCase()}`
}

/** Last committed Gmail history id for this CRM user (an opaque string, never incremented by hand). */
export function readGmailCursor(owner: string): string | null {
  try {
    return localStorage.getItem(cursorKey(owner))
  } catch {
    return null
  }
}

export function saveGmailCursor(owner: string, historyId: string | null): void {
  try {
    if (historyId) localStorage.setItem(cursorKey(owner), historyId)
    else localStorage.removeItem(cursorKey(owner))
  } catch {
    // storage blocked; the next check runs a full refresh
  }
}

/** The mailbox's current history id, taken before a full refresh so nothing that arrives during it is missed. */
export async function gmailHistoryAnchor(owner: string): Promise<string | null> {
  const token = requireToken(owner)
  const res = await gmailFetch(token, '/profile')
  if (!res.ok) return null
  return String(((await res.json()) as { historyId?: string | number }).historyId ?? '') || null
}

export type GmailChanges =
  | { kind: 'changes'; changed: MailMessage[]; removedIds: string[]; historyId: string }
  | { kind: 'expired' }

/** Everything that changed since `startHistoryId`: new mail, deletions, and label (read, star, folder) changes. */
export async function gmailChangesSince(owner: string, startHistoryId: string): Promise<GmailChanges> {
  const token = requireToken(owner)
  const changedIds = new Set<string>()
  const removed = new Set<string>()
  let pageToken = ''
  let latest = startHistoryId
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ startHistoryId, maxResults: '200' })
    for (const type of ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']) params.append('historyTypes', type)
    if (pageToken) params.set('pageToken', pageToken)
    const res = await gmailFetch(token, `/history?${params}`)
    if (res.status === 404) return { kind: 'expired' }
    await ok(res, 'list mailbox changes')
    const json = (await res.json()) as {
      history?: {
        messagesAdded?: { message: { id: string } }[]
        messagesDeleted?: { message: { id: string } }[]
        labelsAdded?: { message: { id: string } }[]
        labelsRemoved?: { message: { id: string } }[]
      }[]
      historyId?: string | number
      nextPageToken?: string
    }
    for (const row of json.history ?? []) {
      for (const item of [...(row.messagesAdded ?? []), ...(row.labelsAdded ?? []), ...(row.labelsRemoved ?? [])]) {
        changedIds.add(item.message.id)
      }
      for (const item of row.messagesDeleted ?? []) removed.add(item.message.id)
    }
    if (json.historyId != null) latest = String(json.historyId)
    if (!json.nextPageToken) break
    pageToken = json.nextPageToken
  }
  for (const id of removed) changedIds.delete(id)
  const changed: MailMessage[] = []
  for (const id of changedIds) {
    // The current state of each changed message collapses repeated changes into one.
    const raw = await getMetadata(token, id)
    if (!raw) {
      removed.add(id)
      continue
    }
    const labels = raw.labelIds ?? []
    if (labels.includes('CHAT')) continue
    changed.push(toMailMessage(raw, folderFromLabels(labels, 'archive')))
  }
  return { kind: 'changes', changed, removedIds: [...removed].map((id) => `${GMAIL_ID_PREFIX}${id}`), historyId: latest }
}

// ── Mailbox checks and extra actions (guide p45, p46, p61-64) ───────────────

/** The Gmail mailbox behind this token, as Google reports it. */
export async function gmailProfile(owner: string): Promise<{ address: string; total: number }> {
  const token = requireToken(owner)
  const res = await ok(await gmailFetch(token, '/profile'), 'return the mailbox profile')
  const json = (await res.json()) as { emailAddress?: string; messagesTotal?: number }
  return { address: json.emailAddress ?? '', total: json.messagesTotal ?? 0 }
}

const LABEL_FOR_FOLDER: Partial<Record<MailFolder, string>> = {
  inbox: 'INBOX',
  sent: 'SENT',
  drafts: 'DRAFT',
  junk: 'SPAM',
  deleted: 'TRASH',
}

/** Total and unread counts per folder from Gmail's system labels. */
export async function gmailFolderCounts(owner: string): Promise<Partial<Record<MailFolder, { total: number; unread: number }>>> {
  const token = requireToken(owner)
  const out: Partial<Record<MailFolder, { total: number; unread: number }>> = {}
  await Promise.all(
    (Object.entries(LABEL_FOR_FOLDER) as [MailFolder, string][]).map(async ([folder, label]) => {
      const res = await gmailFetch(token, `/labels/${label}`)
      if (!res.ok) return
      const json = (await res.json()) as { messagesTotal?: number; messagesUnread?: number }
      out[folder] = { total: json.messagesTotal ?? 0, unread: json.messagesUnread ?? 0 }
    }),
  )
  return out
}

/** Move a Gmail message into a CRM folder using Gmail's own operations. */
export async function moveGmailTo(owner: string, id: string, folder: MailFolder): Promise<void> {
  const token = requireToken(owner)
  const path = `/messages/${encodeURIComponent(gmailId(id))}`
  if (folder === 'deleted') {
    await ok(await gmailFetch(token, `${path}/trash`, { method: 'POST' }), 'move it to Deleted')
    return
  }
  // Out of Trash first (restore), then set the labels for the destination.
  if (folder === 'inbox') await gmailFetch(token, `${path}/untrash`, { method: 'POST' })
  const body =
    folder === 'inbox'
      ? { addLabelIds: ['INBOX'], removeLabelIds: ['SPAM', 'TRASH'] }
      : folder === 'junk'
        ? { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] }
        : folder === 'archive'
          ? { removeLabelIds: ['INBOX', 'SPAM'] }
          : null
  if (!body) throw new Error('Gmail cannot move mail into that folder.')
  await ok(await gmailFetch(token, `${path}/modify`, { method: 'POST', body: JSON.stringify(body) }), 'move the message')
}

export async function setGmailStar(owner: string, id: string, starred: boolean): Promise<void> {
  const token = requireToken(owner)
  await ok(
    await gmailFetch(token, `/messages/${encodeURIComponent(gmailId(id))}/modify`, {
      method: 'POST',
      body: JSON.stringify(starred ? { addLabelIds: ['STARRED'] } : { removeLabelIds: ['STARRED'] }),
    }),
    'update the star',
  )
}

/** Search the whole Gmail mailbox on Google's servers (Gmail search syntax). */
export async function searchGmail(owner: string, query: string): Promise<MailMessage[]> {
  const token = requireToken(owner)
  const q = query.trim()
  if (!q) return []
  const res = await ok(await gmailFetch(token, `/messages?maxResults=25&q=${encodeURIComponent(q)}`), 'search')
  const ids = (((await res.json()) as { messages?: { id: string }[] }).messages ?? []).map((row) => row.id)
  const rows = await Promise.all(ids.map((id) => getMetadata(token, id)))
  return rows
    .filter((raw): raw is NonNullable<typeof raw> => raw != null)
    .map((raw) => toMailMessage(raw, folderFromLabels(raw.labelIds, 'archive')))
}
