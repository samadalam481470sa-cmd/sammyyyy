import { emailOwnerKey, normalizeEmail } from '@/lib/emailIdentity'
import { loadCalendarEvents, saveCalendarEvents, type CalendarEvent } from '@/lib/meetingCalendar'
import {
  deltaOutlookFolder,
  forwardOutlookMail,
  listOutlookEvents,
  listOutlookFolder,
  listOutlookFolderBefore,
  moveOutlookMessage,
  outlookToken,
  replyAllOutlookMail,
  replyOutlookMail,
  sendOutlookDraft,
  sendOutlookMail,
  createOutlookDraft,
  setOutlookRead,
  updateOutlookDraft,
  type OutlookFolderPage,
} from '@/lib/outlookGraph'
import {
  OUTLOOK_SYNC_EVENT,
  isLocalMailId,
  loadDeltaLinks,
  loadMailbox,
  mailboxIsFictional,
  markOutlookSynced,
  mergeMailbox,
  relocateMessage,
  saveDeltaLink,
  saveMailbox,
  type MailFolder,
  type MailMessage,
} from '@/lib/outlookMailbox'
import {
  gmailAddress,
  isGmailConnected,
  isGmailId,
  listGmailFolder,
  markGmailRead,
  moveGmail,
  saveGmailDraft,
  sendGmail,
  sendGmailDraft,
} from '@/lib/gmail'

export const OUTLOOK_SYNCED_EVENT = 'newport-outlook-synced'
/** App-wide check while logged in (any page). Browsers slow hidden tabs to about once a minute. */
export const OUTLOOK_BACKGROUND_SYNC_MS = 15_000
/** Email page open and visible: near-instant new mail. Delta queries keep this cheap. */
export const OUTLOOK_VISIBLE_SYNC_MS = 5_000
/** Quick checks look at these folders; a full refresh covers all of them. */
const QUICK_FOLDERS: MailFolder[] = ['inbox', 'sent', 'drafts']

const MAIL_FOLDERS: MailFolder[] = ['inbox', 'sent', 'drafts', 'junk', 'deleted', 'archive']

export interface OutlookSyncDetail {
  message: string
  mode: 'graph' | 'demo'
}

export function mailPollDelay(visible: boolean): number | null {
  return visible ? OUTLOOK_VISIBLE_SYNC_MS : null
}

export function readSyncDetail(detail: unknown): OutlookSyncDetail {
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const row = detail as OutlookSyncDetail
    return {
      message: String(row.message || 'Outlook check finished.'),
      mode: row.mode === 'graph' ? 'graph' : 'demo',
    }
  }
  if (typeof detail === 'string' && detail) return { message: detail, mode: 'demo' }
  return { message: 'Outlook check finished.', mode: 'demo' }
}

function accountEmail(email: string): string {
  return normalizeEmail(email)
}

function publish(message: string, mode: 'graph' | 'demo'): void {
  const detail: OutlookSyncDetail = { message, mode }
  window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail }))
}


async function pullFolder(token: string, folder: MailFolder, deltaLink?: string): Promise<OutlookFolderPage> {
  if (typeof deltaOutlookFolder === 'function') {
    try {
      return await deltaOutlookFolder(token, folder, deltaLink || null)
    } catch (err) {
      const expired = err instanceof Error && /delta-expired|410/.test(err.message)
      if (!expired && deltaLink) {
        try {
          return await deltaOutlookFolder(token, folder, null)
        } catch {
          // List is the fallback when delta is unavailable.
        }
      } else if (!expired) {
        // Fall through to the message list.
      } else {
        try {
          return await deltaOutlookFolder(token, folder, null)
        } catch {
          // List is the fallback when a delta link has expired.
        }
      }
    }
  }
  const messages = await listOutlookFolder(token, folder)
  return { messages, removedIds: [], full: true, deltaLink: null }
}

async function syncCalendar(token: string, account: string): Promise<void> {
  const events = await listOutlookEvents(token)
  const owner = emailOwnerKey(account)
  const local = loadCalendarEvents(owner).filter((event) => !event.id.startsWith('graph-'))
  const merged = [...local, ...events.filter((event) => !local.some((row) => row.id === event.id))]
  saveCalendarEvents(owner, merged)
  window.dispatchEvent(new CustomEvent('newport-calendar-updated'))
}

/** Email of the CRM user logged in to this tab. */
function sessionOwner(): string {
  try {
    const raw = sessionStorage.getItem('newport_crm_session_user')
    return raw ? accountEmail(String((JSON.parse(raw) as { email?: string }).email ?? '')) : ''
  } catch {
    return ''
  }
}

/** Gmail sync: newest mail in each folder from the connected Gmail account. */
async function syncGmailNow(account: string, incremental: boolean): Promise<'graph' | 'demo'> {
  try {
    let mailbox = loadMailbox(account)
    const known = new Map(mailbox.map((message) => [message.id, message]))
    const folders: MailFolder[] = incremental ? QUICK_FOLDERS : MAIL_FOLDERS
    const results = await Promise.all(
      folders.map(async (folder) => {
        try {
          return { folder, rows: await listGmailFolder(account, folder, known), ok: true as const }
        } catch (err) {
          return { folder, ok: false as const, err }
        }
      }),
    )
    const succeeded = results.flatMap((result) => (result.ok ? [result] : []))
    if (!succeeded.length) {
      const first = results.find((result) => !result.ok)
      throw first && !first.ok ? first.err : new Error('Gmail sync failed.')
    }
    // Outlook mail from an earlier session is not mixed into the Gmail view.
    mailbox = mailbox.filter((message) => isGmailId(message.id) || message.pending)
    for (const result of succeeded) {
      mailbox = mergeMailbox(mailbox, { folder: result.folder, incoming: result.rows, replaceFolder: !incremental, dropDemo: true })
    }
    saveMailbox(account, mailbox)
    markOutlookSynced(account)
    publish(`Mailbox refreshed from Gmail (${gmailAddress(account) || account}).`, 'graph')
    return 'graph'
  } catch (err) {
    markOutlookSynced(account)
    publish(`${err instanceof Error ? err.message : 'Gmail sync failed.'} Saved mail for ${account} is still on screen.`, 'demo')
    return 'demo'
  }
}

export async function syncOutlookNow(
  email: string,
  options?: { incremental?: boolean; mail?: boolean },
): Promise<'graph' | 'demo'> {
  const account = accountEmail(email)
  const includeMail = options?.mail !== false
  if (includeMail && isGmailConnected(account)) return syncGmailNow(account, options?.incremental === true)
  const token = await outlookToken(false)
  if (!token) {
    markOutlookSynced(account)
    if (includeMail) {
      const fictional = mailboxIsFictional(loadMailbox(account))
      publish(
        fictional
          ? `Outlook not connected for ${account}. No mail was retrieved.`
          : `Outlook not connected for ${account}. Showing mail saved in this browser from the last sync.`,
        'demo',
      )
    }
    return 'demo'
  }
  try {
    if (includeMail) {
      const incremental = options?.incremental === true
      const links = loadDeltaLinks(account)
      const results = await Promise.all(
        (incremental ? QUICK_FOLDERS : MAIL_FOLDERS).map(async (folder) => {
          try {
            const page = await pullFolder(token, folder, incremental ? links[folder] : undefined)
            return { folder, page, ok: true as const }
          } catch (err) {
            return { folder, ok: false as const, err }
          }
        }),
      )
      const succeeded = results.flatMap((result) => (result.ok ? [result] : []))
      if (!succeeded.length) {
        const first = results.find((result) => !result.ok)
        throw first && !first.ok ? first.err : new Error('Outlook sync failed.')
      }
      let mailbox = loadMailbox(account)
      for (const result of succeeded) {
        saveDeltaLink(account, result.folder, result.page.deltaLink)
        mailbox = mergeMailbox(mailbox, {
          folder: result.folder,
          incoming: result.page.messages,
          removedIds: result.page.removedIds,
          replaceFolder: result.page.full,
          dropDemo: true,
        })
      }
      saveMailbox(account, mailbox)
    }
    await syncCalendar(token, account)
    markOutlookSynced(account)
    if (includeMail) publish(`Mailbox refreshed from Microsoft Graph for ${account}.`, 'graph')
    return 'graph'
  } catch (err) {
    markOutlookSynced(account)
    if (includeMail) {
      const message = err instanceof Error ? err.message : 'Outlook sync failed.'
      const fictional = mailboxIsFictional(loadMailbox(account))
      publish(
        fictional
          ? `${message} Showing the fictional mailbox for ${account}.`
          : `${message} Saved mail for ${account} is still on screen.`,
        'demo',
      )
    }
    return 'demo'
  }
}

/** Load the next 25 older emails in a folder. Returns how many were added. */
export async function loadOlderMail(email: string, folder: MailFolder): Promise<number> {
  const account = accountEmail(email)
  const mailbox = loadMailbox(account)
  const inFolder = mailbox.filter((message) => message.folder === folder && !message.pending)
  const oldest = inFolder.reduce((min, message) => (message.at < min ? message.at : min), new Date().toISOString())
  let older: MailMessage[]
  if (isGmailConnected(account)) {
    const known = new Map(mailbox.map((message) => [message.id, message]))
    older = await listGmailFolder(account, folder, known, 25, oldest)
  } else {
    const token = await outlookToken(false)
    if (!token) throw new Error('Connect Outlook to load older emails.')
    older = await listOutlookFolderBefore(token, folder, oldest)
  }
  const fresh = older.filter((message) => !mailbox.some((row) => row.id === message.id))
  saveMailbox(account, mergeMailbox(loadMailbox(account), { folder, incoming: fresh }))
  return fresh.length
}

export async function deliverMail(input: {
  email: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  replyToId?: string
  action?: 'send' | 'reply' | 'replyAll' | 'forward'
  /** Replies to fictional samples stay in that login's demo Sent folder. */
  skipGraph?: boolean
}): Promise<'graph' | 'demo'> {
  const account = accountEmail(input.email)
  const action = input.action ?? (input.replyToId ? 'reply' : 'send')
  if (isGmailConnected(account)) {
    if (!input.to.includes('@')) throw new Error('Add a recipient. Nothing was sent.')
    try {
      await sendGmail(account, input)
      return 'graph'
    } catch (err) {
      throw new Error(`Gmail did not send the message. Nothing was delivered. ${err instanceof Error ? err.message : ''}`.trim())
    }
  }
  if (!input.skipGraph) {
    const token = await outlookToken(false)
    const graphId = input.replyToId && !isLocalMailId(input.replyToId) ? input.replyToId : ''
    if (token && graphId && (action === 'reply' || action === 'replyAll' || action === 'forward')) {
      try {
        if (action === 'forward') {
          await forwardOutlookMail(token, graphId, {
            to: input.to,
            cc: input.cc,
            bcc: input.bcc,
            comment: input.body,
          })
        } else if (action === 'replyAll') {
          await replyAllOutlookMail(token, graphId, input.body)
        } else {
          await replyOutlookMail(token, graphId, input.body)
        }
        return 'graph'
      } catch (err) {
        throw new Error(`Outlook did not send the reply. Nothing was delivered. ${err instanceof Error ? err.message : ''}`.trim())
      }
    }
    if (token && action === 'send' && input.to.includes('@')) {
      try {
        await sendOutlookMail(token, {
          to: input.to,
          subject: input.subject,
          body: input.body,
          ...(input.cc ? { cc: input.cc } : {}),
          ...(input.bcc ? { bcc: input.bcc } : {}),
        })
        return 'graph'
      } catch (err) {
        throw new Error(`Outlook did not send the message. Nothing was delivered. ${err instanceof Error ? err.message : ''}`.trim())
      }
    }
  }
  void account
  throw new Error('Outlook is not connected. Nothing was sent. Click Connect Outlook first.')
}

export async function pushMailMove(id: string, folder: 'deleted' | 'archive'): Promise<void> {
  if (isLocalMailId(id)) return
  if (isGmailId(id)) return moveGmail(sessionOwner(), id, folder)
  const token = await outlookToken(false)
  if (!token) return
  await moveOutlookMessage(token, id, folder === 'deleted' ? 'deleteditems' : 'archive')
}

export async function pushMailRead(id: string, read: boolean): Promise<void> {
  if (isLocalMailId(id)) return
  if (isGmailId(id)) return markGmailRead(sessionOwner(), id, read)
  const token = await outlookToken(false)
  if (!token) return
  await setOutlookRead(token, id, read)
}

export async function saveDraftMail(input: {
  email: string
  id?: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  localOnly?: boolean
}): Promise<MailMessage> {
  const account = accountEmail(input.email)
  const base: MailMessage = {
    id: input.id && isLocalMailId(input.id) ? input.id : `demo-local-draft-${Date.now()}`,
    folder: 'drafts',
    from: account,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject.trim() || '(no subject)',
    preview: input.body.trim().slice(0, 140) || 'Fictional unsent draft.',
    body: input.body,
    at: new Date().toISOString(),
    read: true,
    demo: true,
    bodyLoaded: true,
  }
  if (!input.localOnly && isGmailConnected(account)) {
    try {
      const id = await saveGmailDraft(account, input)
      const saved: MailMessage = { ...base, id, demo: false, preview: base.preview || '(draft)' }
      const without = loadMailbox(account).filter((message) => message.id !== input.id && message.id !== id)
      saveMailbox(account, [saved, ...without])
      return saved
    } catch {
      // Gmail refused the draft; keep it in this browser only (marked local).
    }
  } else if (!input.localOnly) {
    const token = await outlookToken(false)
    const graphId = input.id && !isLocalMailId(input.id) ? input.id : ''
    if (token) {
      try {
        const payload = { to: input.to, cc: input.cc, bcc: input.bcc, subject: input.subject, body: input.body }
        const id = graphId ? (await updateOutlookDraft(token, graphId, payload), graphId) : await createOutlookDraft(token, payload)
        const saved: MailMessage = { ...base, id, demo: false, preview: base.preview || '(draft)' }
        const without = loadMailbox(account).filter((message) => message.id !== input.id && message.id !== id)
        saveMailbox(account, [saved, ...without])
        return saved
      } catch {
        // Graph refused the draft; keep it in this browser only (marked local).
      }
    }
  }
  const without = loadMailbox(account).filter((message) => message.id !== base.id && message.id !== input.id)
  saveMailbox(account, [base, ...without])
  return base
}

export async function sendDraftMail(email: string, message: MailMessage): Promise<'graph' | 'demo'> {
  const account = accountEmail(email)
  if (!message.demo && isGmailId(message.id)) {
    try {
      await sendGmailDraft(account, message.id)
      const next = relocateMessage(loadMailbox(account), message.id, 'sent').map((row) =>
        row.id === message.id ? { ...row, read: true } : row,
      )
      saveMailbox(account, next)
      return 'graph'
    } catch (err) {
      throw new Error(`Gmail did not send the draft. ${err instanceof Error ? err.message : ''}`.trim())
    }
  }
  if (!message.demo && !isLocalMailId(message.id)) {
    const token = await outlookToken(false)
    if (token) {
      try {
        await sendOutlookDraft(token, message.id)
        const next = relocateMessage(loadMailbox(account), message.id, 'sent').map((row) =>
          row.id === message.id ? { ...row, pending: true, read: true } : row,
        )
        saveMailbox(account, next)
        return 'graph'
      } catch (err) {
        throw new Error(`Outlook did not send the draft. ${err instanceof Error ? err.message : ''}`.trim())
      }
    }
  }
  void account
  throw new Error('Outlook is not connected. The draft was not sent. Click Connect Outlook first.')
}

let mailSurfaceActive = false

export function setOutlookMailSurfaceActive(active: boolean): void {
  mailSurfaceActive = active
}

export function isOutlookMailSurfaceActive(): boolean {
  return mailSurfaceActive
}

export const NEW_MAIL_EVENT = 'newport-new-mail'

function unreadInbox(account: string): MailMessage[] {
  return loadMailbox(account).filter((message) => message.folder === 'inbox' && !message.read && !message.demo)
}

/**
 * Keeps the logged-in user's mail current on every page: a check every 15 seconds, plus an
 * immediate check when the window regains focus, becomes visible, or comes back online.
 * Shows the unread count in the tab title and announces new mail. Stops at logout.
 */
export function installOutlookSync(email: string): () => void {
  const account = accountEmail(email)
  const baseTitle = typeof document !== 'undefined' ? document.title.replace(/^\(\d+\)\s*/, '') : ''
  let seen = new Set(unreadInbox(account).map((message) => message.id))
  let running = false
  let lastRun = 0

  const afterSync = () => {
    const unread = unreadInbox(account)
    const fresh = unread.filter((message) => !seen.has(message.id))
    seen = new Set(unread.map((message) => message.id))
    if (typeof document !== 'undefined') document.title = unread.length ? `(${unread.length}) ${baseTitle}` : baseTitle
    if (fresh.length) window.dispatchEvent(new CustomEvent(NEW_MAIL_EVENT, { detail: { count: fresh.length, latest: fresh[0] } }))
  }
  const run = (incremental: boolean, mail: boolean) => {
    if (running) return
    running = true
    lastRun = Date.now()
    void syncOutlookNow(account, { incremental, mail })
      .catch(() => 'demo')
      .finally(() => {
        running = false
        afterSync()
      })
  }
  const onRequest = () => run(false, true)
  const tick = () => run(true, !mailSurfaceActive)
  // Back to the window: check right away (at most once every 3 seconds).
  const onWake = () => {
    if (document.visibilityState === 'hidden') return
    if (Date.now() - lastRun < 3_000) return
    run(true, true)
  }
  const onSynced = () => afterSync()
  window.addEventListener(OUTLOOK_SYNC_EVENT, onRequest)
  window.addEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
  window.addEventListener('focus', onWake)
  window.addEventListener('online', onWake)
  document.addEventListener('visibilitychange', onWake)
  const timer = window.setInterval(tick, OUTLOOK_BACKGROUND_SYNC_MS)
  run(true, true)
  return () => {
    window.removeEventListener(OUTLOOK_SYNC_EVENT, onRequest)
    window.removeEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
    window.removeEventListener('focus', onWake)
    window.removeEventListener('online', onWake)
    document.removeEventListener('visibilitychange', onWake)
    window.clearInterval(timer)
    if (typeof document !== 'undefined') document.title = baseTitle
  }
}

export function graphCalendarIds(events: CalendarEvent[]): string[] {
  return events.filter((event) => event.id.startsWith('graph-')).map((event) => event.id)
}
