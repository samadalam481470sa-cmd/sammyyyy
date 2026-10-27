import { emailOwnerKey, normalizeEmail } from '@/lib/emailIdentity'
import { loadCalendarEvents, saveCalendarEvents, type CalendarEvent } from '@/lib/meetingCalendar'
import {
  deltaOutlookFolder,
  forwardOutlookMail,
  listOutlookEvents,
  listOutlookFolder,
  listOutlookFolderBefore,
  moveOutlookTo,
  outlookFolderCounts,
  outlookMailboxProfile,
  searchOutlook,
  setOutlookFlag,
  sendOutlookWithAttachments,
  type FolderCount,
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
  markOutlookSynced,
  mergeMailbox,
  relocateMessage,
  saveDeltaLink,
  saveMailbox,
  mailProvider,
  type MailFolder,
  type MailMessage,
  type MailProvider,
  type OutgoingAttachment,
} from '@/lib/outlookMailbox'
import {
  gmailChangesSince,
  gmailFolderCounts,
  gmailProfile,
  moveGmailTo,
  searchGmail,
  setGmailStar,
  gmailHistoryAnchor,
  isGmailConnected,
  readGmailCursor,
  saveGmailCursor,
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

export type MailSyncState = 'not_connected' | 'loading' | 'current' | 'failed'

export interface ProviderHealth {
  state: MailSyncState
  /** Last successful sync (ISO). */
  at?: string
  error?: string
}

const health: Record<string, Partial<Record<MailProvider, ProviderHealth>>> = {}

/** Per-account sync state for the mailbox check and status bar (guide p15). */
export function mailSyncHealth(email: string): Partial<Record<MailProvider, ProviderHealth>> {
  return health[accountEmail(email)] ?? {}
}

function setHealth(account: string, provider: MailProvider, next: ProviderHealth): void {
  const prev = health[account]?.[provider]
  health[account] = { ...health[account], [provider]: { at: prev?.at, ...next } }
}

/** Gmail: a full refresh lists each folder; quick checks replay Gmail's change history (guide p47, p49). */
async function syncGmailMail(account: string, incremental: boolean): Promise<void> {
  const cursor = readGmailCursor(account)
  if (incremental && cursor) {
    const changes = await gmailChangesSince(account, cursor)
    if (changes.kind === 'changes') {
      if (changes.changed.length || changes.removedIds.length) {
        saveMailbox(account, mergeMailbox(loadMailbox(account), { incoming: changes.changed, removedIds: changes.removedIds }))
      }
      saveGmailCursor(account, changes.historyId)
      return
    }
    // History no longer available: rebuild with a full refresh below.
  }
  // Anchor first, so mail that arrives during the refresh is caught by the next quick check.
  const anchor = await gmailHistoryAnchor(account)
  let mailbox = loadMailbox(account)
  const known = new Map(mailbox.map((message) => [message.id, message]))
  const results = await Promise.all(
    MAIL_FOLDERS.map(async (folder) => {
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
  for (const result of succeeded) {
    mailbox = mergeMailbox(mailbox, { folder: result.folder, incoming: result.rows, replaceFolder: true, dropDemo: true, provider: 'gmail' })
  }
  saveMailbox(account, mailbox)
  if (succeeded.length === results.length) saveGmailCursor(account, anchor)
}

/** Outlook: delta queries per folder; quick checks cover Inbox, Sent, and Drafts. */
async function syncOutlookMail(account: string, token: string, incremental: boolean): Promise<void> {
  // One-time switch to permanent ids: older rows used ids that change when mail moves.
  const migrated = `newport_outlook_idv2:${account}`
  let fresh = false
  try {
    fresh = localStorage.getItem(migrated) == null
  } catch {
    fresh = false
  }
  const links = fresh ? {} : loadDeltaLinks(account)
  const quick = incremental && !fresh
  const results = await Promise.all(
    (quick ? QUICK_FOLDERS : MAIL_FOLDERS).map(async (folder) => {
      try {
        const page = await pullFolder(token, folder, quick ? links[folder] : undefined)
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
  if (fresh) mailbox = mailbox.filter((message) => mailProvider(message) !== 'outlook' || message.pending)
  for (const result of succeeded) {
    saveDeltaLink(account, result.folder, result.page.deltaLink)
    mailbox = mergeMailbox(mailbox, {
      folder: result.folder,
      incoming: result.page.messages,
      removedIds: result.page.removedIds,
      replaceFolder: result.page.full,
      dropDemo: true,
      provider: 'outlook',
    })
  }
  saveMailbox(account, mailbox)
  if (fresh && succeeded.length === results.length) {
    try {
      localStorage.setItem(migrated, '1')
    } catch {
      // ignore
    }
  }
}

function describe(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * Refresh every mailbox this CRM user connected: Outlook and Gmail sync independently and
 * show up together in one inbox. One account failing never hides the other's mail.
 */
export async function syncOutlookNow(
  email: string,
  options?: { incremental?: boolean; mail?: boolean },
): Promise<'graph' | 'demo'> {
  const account = accountEmail(email)
  const includeMail = options?.mail !== false
  const incremental = options?.incremental === true
  const gmailOn = isGmailConnected(account)
  const token = await outlookToken(false)
  const parts: string[] = []
  let anyLive = false

  const outlookJob = (async () => {
    if (!token) {
      setHealth(account, 'outlook', { state: 'not_connected' })
      return
    }
    try {
      if (includeMail) {
        if (!health[account]?.outlook?.at) setHealth(account, 'outlook', { state: 'loading' })
        await syncOutlookMail(account, token, incremental)
        setHealth(account, 'outlook', { state: 'current', at: new Date().toISOString() })
        parts.push('Outlook up to date')
      }
      anyLive = true
      await syncCalendar(token, account).catch(() => undefined)
    } catch (err) {
      setHealth(account, 'outlook', { state: 'failed', error: describe(err, 'Outlook sync failed.') })
      parts.push(`Outlook: ${describe(err, 'sync failed')}`)
    }
  })()

  const gmailJob = (async () => {
    if (!includeMail) return
    if (!gmailOn) {
      setHealth(account, 'gmail', { state: 'not_connected' })
      return
    }
    try {
      if (!health[account]?.gmail?.at) setHealth(account, 'gmail', { state: 'loading' })
      await syncGmailMail(account, incremental)
      setHealth(account, 'gmail', { state: 'current', at: new Date().toISOString() })
      parts.push('Gmail up to date')
      anyLive = true
    } catch (err) {
      setHealth(account, 'gmail', { state: 'failed', error: describe(err, 'Gmail sync failed.') })
      parts.push(`Gmail: ${describe(err, 'sync failed')}`)
    }
  })()

  await Promise.all([outlookJob, gmailJob])
  markOutlookSynced(account)
  if (includeMail) {
    if (!token && !gmailOn) {
      const saved = loadMailbox(account).some((message) => !message.demo)
      publish(
        saved
          ? `No mailbox connected for ${account}. Showing mail saved on this device from the last sync.`
          : `No mailbox connected for ${account}. Connect Outlook or Gmail to load mail.`,
        'demo',
      )
    } else {
      publish(`${parts.join(' · ') || 'Mail checked'}.`, anyLive ? 'graph' : 'demo')
    }
  }
  return anyLive ? 'graph' : 'demo'
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
  /** Sending account. Replies default to the account the original message is in. */
  via?: MailProvider
  attachments?: OutgoingAttachment[]
  /** Replies to fictional samples stay in that login's demo Sent folder. */
  skipGraph?: boolean
}): Promise<'graph' | 'demo'> {
  const account = accountEmail(input.email)
  const action = input.action ?? (input.replyToId ? 'reply' : 'send')
  const via: MailProvider =
    input.via ?? (input.replyToId && !isLocalMailId(input.replyToId) ? mailProvider({ id: input.replyToId }) : isGmailConnected(account) && !(await outlookToken(false)) ? 'gmail' : 'outlook')
  if (via === 'gmail') {
    if (!isGmailConnected(account)) throw new Error('Gmail is not connected. Nothing was sent. Click Connect Gmail first.')
    if (!input.to.includes('@')) throw new Error('Add a recipient. Nothing was sent.')
    try {
      await sendGmail(account, input)
      return 'graph'
    } catch (err) {
      throw new Error(`Gmail did not send the message. Nothing was delivered. ${err instanceof Error ? err.message : ''}`.trim())
    }
  }
  if (!input.skipGraph && input.attachments?.length) {
    const token = await outlookToken(false)
    if (!token) throw new Error('Outlook is not connected. Nothing was sent. Click Connect Outlook first.')
    const graphId = input.replyToId && !isLocalMailId(input.replyToId) ? input.replyToId : undefined
    try {
      await sendOutlookWithAttachments(token, { ...input, action: graphId ? action : 'send', replyToId: graphId, attachments: input.attachments })
      return 'graph'
    } catch (err) {
      throw new Error(describe(err, 'Outlook did not send the message. Nothing was delivered.'))
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
  via?: MailProvider
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
  const draftVia: MailProvider =
    input.via ?? (input.id && isGmailId(input.id) ? 'gmail' : isGmailConnected(account) && !(await outlookToken(false)) ? 'gmail' : 'outlook')
  if (!input.localOnly && draftVia === 'gmail' && isGmailConnected(account)) {
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

// ── Account-neutral actions for the Email page ──────────────────────────────

/** Move a message to any folder in its own account: restore to Inbox, Junk, Not junk, Archive, Deleted. */
export async function pushMailMoveTo(id: string, folder: MailFolder): Promise<void> {
  if (isLocalMailId(id)) return
  if (isGmailId(id)) return moveGmailTo(sessionOwner(), id, folder)
  const token = await outlookToken(false)
  if (!token) throw new Error('Outlook is not connected.')
  await moveOutlookTo(token, id, folder)
}

/** Outlook follow-up flag or Gmail star. */
export async function pushMailFlag(id: string, flagged: boolean): Promise<void> {
  if (isLocalMailId(id)) return
  if (isGmailId(id)) return setGmailStar(sessionOwner(), id, flagged)
  const token = await outlookToken(false)
  if (!token) throw new Error('Outlook is not connected.')
  await setOutlookFlag(token, id, flagged)
}

export interface MailSearchResult {
  messages: MailMessage[]
  /** Accounts that were searched on the provider's servers. */
  searched: MailProvider[]
  failed: { provider: MailProvider; error: string }[]
}

/** Search the full mailboxes on Microsoft's and Google's servers, not only mail already loaded (guide p63). */
export async function searchMailboxes(email: string, query: string): Promise<MailSearchResult> {
  const account = accountEmail(email)
  const result: MailSearchResult = { messages: [], searched: [], failed: [] }
  const token = await outlookToken(false)
  await Promise.all([
    (async () => {
      if (!token) return
      try {
        result.messages.push(...(await searchOutlook(token, query)))
        result.searched.push('outlook')
      } catch (err) {
        result.failed.push({ provider: 'outlook', error: describe(err, 'search failed') })
      }
    })(),
    (async () => {
      if (!isGmailConnected(account)) return
      try {
        result.messages.push(...(await searchGmail(account, query)))
        result.searched.push('gmail')
      } catch (err) {
        result.failed.push({ provider: 'gmail', error: describe(err, 'search failed') })
      }
    })(),
  ])
  result.messages.sort((a, b) => b.at.localeCompare(a.at))
  return result
}

export type FolderCounts = Partial<Record<MailProvider, Partial<Record<MailFolder, FolderCount>>>>

/** Server-side total and unread counts per folder for each connected account. */
export async function mailboxFolderCounts(email: string): Promise<FolderCounts> {
  const account = accountEmail(email)
  const out: FolderCounts = {}
  const token = await outlookToken(false)
  await Promise.all([
    token ? outlookFolderCounts(token).then((counts) => (out.outlook = counts)).catch(() => undefined) : undefined,
    isGmailConnected(account) ? gmailFolderCounts(account).then((counts) => (out.gmail = counts)).catch(() => undefined) : undefined,
  ])
  return out
}

export interface MailboxCheckRow {
  provider: MailProvider
  connected: boolean
  /** Mailbox address the provider reports for this connection. */
  address?: string
  signInName?: string
  personal?: boolean
  warning?: string
  state: MailSyncState
  lastSync?: string
  error?: string
  /** Messages the provider holds vs. messages loaded here, per folder. */
  folders: { folder: MailFolder; serverTotal?: number; serverUnread?: number; loaded: number }[]
}

const CONSUMER_DOMAINS = /@(outlook|hotmail|live|msn|passport)\.[a-z.]+$/i

/**
 * Read-only mailbox check (guide p4, p11): which mailbox each connection really reads, how many
 * messages the provider holds, how many are loaded here, and the last sync result. No tokens or
 * message contents are shown.
 */
export async function mailboxCheck(email: string): Promise<MailboxCheckRow[]> {
  const account = accountEmail(email)
  const loaded = loadMailbox(account)
  const counts = await mailboxFolderCounts(account)
  const rows: MailboxCheckRow[] = []
  const folderRows = (provider: MailProvider) =>
    MAIL_FOLDERS.map((folder) => ({
      folder,
      serverTotal: counts[provider]?.[folder]?.total,
      serverUnread: counts[provider]?.[folder]?.unread,
      loaded: loaded.filter((message) => message.folder === folder && mailProvider(message) === provider && !message.demo).length,
    }))
  const h = mailSyncHealth(account)

  const token = await outlookToken(false)
  if (token) {
    const row: MailboxCheckRow = { provider: 'outlook', connected: true, state: h.outlook?.state ?? 'loading', lastSync: h.outlook?.at, error: h.outlook?.error, folders: folderRows('outlook') }
    try {
      const profile = await outlookMailboxProfile(token)
      row.address = profile.address
      row.signInName = profile.signInName
      row.personal = profile.personal
      if (profile.personal && profile.signInName && !CONSUMER_DOMAINS.test(profile.signInName)) {
        row.warning = `This personal Microsoft account signs in with ${profile.signInName}. Mail sent to that address goes to its own provider (for example Gmail), not to this Outlook mailbox. Connect Gmail to read it, or switch to a work, school, or Outlook.com mailbox.`
      }
    } catch (err) {
      row.error = describe(err, 'Microsoft did not return the mailbox profile.')
    }
    rows.push(row)
  } else {
    rows.push({ provider: 'outlook', connected: false, state: 'not_connected', folders: folderRows('outlook') })
  }

  if (isGmailConnected(account)) {
    const row: MailboxCheckRow = { provider: 'gmail', connected: true, state: h.gmail?.state ?? 'loading', lastSync: h.gmail?.at, error: h.gmail?.error, folders: folderRows('gmail') }
    try {
      row.address = (await gmailProfile(account)).address
    } catch (err) {
      row.error = describe(err, 'Google did not return the mailbox profile.')
    }
    rows.push(row)
  } else {
    rows.push({ provider: 'gmail', connected: false, state: 'not_connected', folders: folderRows('gmail') })
  }
  return rows
}
