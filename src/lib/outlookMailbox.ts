import { normalizeEmail } from '@/lib/emailIdentity'
import { recipientKey } from '@/lib/mailAddress'

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'junk' | 'deleted' | 'archive'

export interface MailAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

export interface MailMessage {
  id: string
  folder: MailFolder
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  preview: string
  body: string
  bodyHtml?: string
  at: string
  read: boolean
  demo: boolean
  hasAttachments?: boolean
  attachments?: MailAttachment[]
  /** Full body has been loaded. List sync leaves this false so bodies are not fetched up front. */
  bodyLoaded?: boolean
  /** Shown in Sent immediately, then replaced when Graph returns the real item. */
  pending?: boolean
}

export const MAIL_FOLDERS: { id: MailFolder; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'junk', label: 'Junk' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'archive', label: 'Archive' },
]

const FOLDER_IDS = new Set<MailFolder>(MAIL_FOLDERS.map((folder) => folder.id))

function accountEmail(email: string): string {
  return normalizeEmail(email)
}

function mailboxKey(email: string): string {
  return `newport_outlook_mailbox_v1:${accountEmail(email)}`
}

function syncKey(email: string): string {
  return `newport_outlook_last_sync_v1:${accountEmail(email)}`
}

function deltaKey(email: string): string {
  return `newport_outlook_delta_v1:${accountEmail(email)}`
}

/** Fictional samples used only when this login has no Graph mailbox yet. */
export function demoMailbox(email: string): MailMessage[] {
  const address = accountEmail(email) || 'signed-in@newport.example'
  return [
    {
      id: 'demo-mail-1',
      folder: 'inbox',
      from: 'demo.banker@fictional-advisory.test',
      to: address,
      subject: 'Fictional teaser for Project Q',
      preview: 'Fictional sample. This message was not received from Outlook.',
      body: `Fictional sample for ${address}. Connect Outlook to read and send mail from this Microsoft mailbox.`,
      at: '2026-10-26T14:00:00Z',
      read: false,
      demo: true,
      bodyLoaded: true,
    },
    {
      id: 'demo-mail-2',
      folder: 'sent',
      from: address,
      to: 'demo.counsel@fictional-law.test',
      subject: 'Fictional demo follow-up',
      preview: 'Fictional demo. Microsoft did not deliver this.',
      body: `Fictional sent item from ${address}. No email left this browser.`,
      at: '2026-10-25T18:30:00Z',
      read: true,
      demo: true,
      bodyLoaded: true,
    },
    {
      id: 'demo-mail-3',
      folder: 'drafts',
      from: address,
      to: '',
      subject: 'Draft: fictional introduction',
      preview: 'Fictional unsent demo draft.',
      body: `Finish this only inside the fictional demo mailbox for ${address}. It is not in Outlook.`,
      at: '2026-10-24T12:00:00Z',
      read: true,
      demo: true,
      bodyLoaded: true,
    },
    {
      id: 'demo-mail-4',
      folder: 'junk',
      from: 'demo.noise@fictional-mail.test',
      to: address,
      subject: 'Fictional junk notice',
      preview: 'Fictional sample. This message was not received from Outlook.',
      body: `Fictional junk sample for ${address}.`,
      at: '2026-10-23T09:00:00Z',
      read: true,
      demo: true,
      bodyLoaded: true,
    },
    {
      id: 'demo-mail-5',
      folder: 'deleted',
      from: 'demo.archive@fictional-mail.test',
      to: address,
      subject: 'Fictional deleted note',
      preview: 'Fictional sample. This message was not received from Outlook.',
      body: `Fictional deleted sample for ${address}.`,
      at: '2026-10-22T09:00:00Z',
      read: true,
      demo: true,
      bodyLoaded: true,
    },
    {
      id: 'demo-mail-6',
      folder: 'archive',
      from: 'demo.files@fictional-mail.test',
      to: address,
      subject: 'Fictional archived note',
      preview: 'Fictional sample. This message was not received from Outlook.',
      body: `Fictional archive sample for ${address}.`,
      at: '2026-10-21T09:00:00Z',
      read: true,
      demo: true,
      bodyLoaded: true,
    },
  ]
}

function isMailMessage(value: unknown): value is MailMessage {
  if (!value || typeof value !== 'object') return false
  const row = value as MailMessage
  return typeof row.id === 'string' && FOLDER_IDS.has(row.folder)
}

export function loadMailbox(email: string): MailMessage[] {
  try {
    const raw = localStorage.getItem(mailboxKey(email))
    if (raw == null) return demoMailbox(email)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return demoMailbox(email)
    return parsed.filter(isMailMessage)
  } catch {
    return demoMailbox(email)
  }
}

export function saveMailbox(email: string, messages: MailMessage[]): void {
  localStorage.setItem(mailboxKey(email), JSON.stringify(messages))
}

export function lastOutlookSync(email: string): string | null {
  try {
    return localStorage.getItem(syncKey(email))
  } catch {
    return null
  }
}

export function markOutlookSynced(email: string): string {
  const at = new Date().toISOString()
  localStorage.setItem(syncKey(email), at)
  return at
}

export function mailboxIsFictional(messages: MailMessage[]): boolean {
  return messages.length > 0 && messages.every((message) => message.demo)
}

export function isLocalMailId(id: string): boolean {
  return id.startsWith('demo-') || id.startsWith('pending-')
}

export function loadDeltaLinks(email: string): Partial<Record<MailFolder, string>> {
  try {
    const raw = localStorage.getItem(deltaKey(email))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<Record<MailFolder, string>>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveDeltaLink(email: string, folder: MailFolder, link: string | null): void {
  const current = loadDeltaLinks(email)
  if (link) current[folder] = link
  else delete current[folder]
  localStorage.setItem(deltaKey(email), JSON.stringify(current))
}

export interface MailMergePatch {
  incoming: MailMessage[]
  removedIds?: string[]
  folder?: MailFolder
  /** Drop Graph messages in `folder` that this full snapshot did not return. Pending rows stay. */
  replaceFolder?: boolean
  /** Real Graph mail replaces the fictional sample mailbox. */
  dropDemo?: boolean
}

function mergeMailFields(prev: MailMessage, row: MailMessage): MailMessage {
  return {
    ...prev,
    ...row,
    body: row.body?.trim() ? row.body : prev.body,
    bodyHtml: row.bodyHtml?.trim() ? row.bodyHtml : prev.bodyHtml,
    preview: row.preview?.trim() ? row.preview : prev.preview,
    cc: row.cc ?? prev.cc,
    bcc: row.bcc ?? prev.bcc,
    attachments: row.attachments ?? prev.attachments,
    hasAttachments: row.hasAttachments ?? prev.hasAttachments,
    bodyLoaded: Boolean(row.bodyLoaded || prev.bodyLoaded),
    pending: row.pending ?? false,
  }
}

function sameDelivery(pending: MailMessage, real: MailMessage): boolean {
  return (
    !real.pending &&
    !real.demo &&
    real.folder === pending.folder &&
    real.subject === pending.subject &&
    recipientKey(real.to) === recipientKey(pending.to) &&
    recipientKey(real.cc) === recipientKey(pending.cc)
  )
}

function dropReconciledPending(messages: MailMessage[]): MailMessage[] {
  const real = messages.filter((message) => !message.pending)
  return messages.filter((message) => {
    if (!message.pending) return true
    return !real.some((row) => sameDelivery(message, row))
  })
}

/** Merge by message id. Incoming rows replace the same id. Pending sends stay until Graph lists them. */
export function mergeMailbox(existing: MailMessage[], patch: MailMergePatch): MailMessage[] {
  const removed = new Set(patch.removedIds ?? [])
  let next = existing.filter((message) => !removed.has(message.id))
  if (patch.dropDemo) next = next.filter((message) => !message.demo)
  if (patch.replaceFolder && patch.folder) {
    const incomingIds = new Set(patch.incoming.map((message) => message.id))
    const folder = patch.folder
    next = next.filter((message) => {
      if (message.folder !== folder) return true
      if (message.pending || message.id.startsWith('pending-')) return true
      return incomingIds.has(message.id)
    })
  }
  const byId = new Map(next.map((message) => [message.id, message]))
  for (const row of patch.incoming) {
    if (removed.has(row.id)) continue
    const prev = byId.get(row.id)
    byId.set(row.id, prev ? mergeMailFields(prev, row) : row)
  }
  return dropReconciledPending([...byId.values()])
}

export function filterMailbox(messages: MailMessage[], folder: MailFolder, query: string): MailMessage[] {
  const needle = query.trim().toLowerCase()
  return messages
    .filter((message) => message.folder === folder)
    .filter((message) => {
      if (!needle) return true
      const haystack = [message.from, message.to, message.cc, message.bcc, message.subject, message.preview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function relocateMessage(messages: MailMessage[], id: string, folder: MailFolder): MailMessage[] {
  return messages.map((message) => (message.id === id ? { ...message, folder } : message))
}

export function makePendingSent(input: {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
}): MailMessage {
  const subject = input.subject.trim() || '(no subject)'
  const preview = input.body.trim().slice(0, 140) || 'Sending…'
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    folder: 'sent',
    from: accountEmail(input.from),
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject,
    preview,
    body: input.body,
    at: new Date().toISOString(),
    read: true,
    demo: false,
    pending: true,
    bodyLoaded: true,
  }
}

export function formatMailTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

export const OUTLOOK_SYNC_EVENT = 'newport-outlook-sync'

export function requestOutlookSync(): void {
  window.dispatchEvent(new CustomEvent(OUTLOOK_SYNC_EVENT))
}
