import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarPlus,
  CheckSquare,
  FileText,
  Flag,
  Forward,
  HelpCircle,
  Inbox,
  Info,
  Keyboard,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Square,
  Stethoscope,
  Trash,
  Trash2,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ensureMsal } from '@/auth/msal'
import { useAuth } from '@/auth/AuthContext'
import { AddToCalendarDialog } from '@/components/email/AddToCalendarDialog'
import { MailBody } from '@/components/email/MailBody'
import { CapabilitiesDialog, MailboxCheckDialog, ShortcutsDialog } from '@/components/email/MailDialogs'
import { normalizeEmail } from '@/lib/emailIdentity'
import { parseAddresses, uniqueAddresses } from '@/lib/mailAddress'
import {
  UNDO_SEND_MS,
  attachmentProblem,
  invalidAddresses,
  loadComposeLocally,
  loadSignature,
  readAttachment,
  saveComposeLocally,
  saveSignature,
  withSignature,
} from '@/lib/mailCompose'
import { meetingFromMail, meetingLabel, type MailMeetingDraft } from '@/lib/mailMeeting'
import {
  GmailSetupError,
  gmailNeedsRenewal,
  rememberedGmail,
  connectGmail,
  disconnectGmail,
  downloadGmailAttachment,
  getGmailMessage,
  gmailAddress,
  gmailClientId,
  isGmailConnected,
  isGmailId,
  preloadGmail,
} from '@/lib/gmail'
import {
  MAIL_FOLDERS,
  filterMailbox,
  formatMailTime,
  isLocalMailId,
  isTypingTarget,
  lastOutlookSync,
  loadMailbox,
  mailProvider,
  makePendingSent,
  mergeMailbox,
  relocateMessage,
  saveMailbox,
  type MailAttachment,
  type MailFolder,
  type MailMessage,
  type MailProvider,
  type OutgoingAttachment,
} from '@/lib/outlookMailbox'
import {
  connectedMailboxAddress,
  disconnectOutlookMailbox,
  downloadOutlookAttachment,
  getOutlookMessage,
  graphTokenError,
  listOutlookAttachments,
  outlookToken,
} from '@/lib/outlookGraph'
import {
  OUTLOOK_SYNCED_EVENT,
  OUTLOOK_VISIBLE_SYNC_MS,
  deliverMail,
  loadOlderMail,
  mailSyncHealth,
  mailboxFolderCounts,
  pushMailFlag,
  pushMailMoveTo,
  pushMailRead,
  readSyncDetail,
  saveDraftMail,
  searchMailboxes,
  sendDraftMail,
  setOutlookMailSurfaceActive,
  syncOutlookNow,
  type FolderCounts,
  type MailSearchResult,
  type ProviderHealth,
} from '@/lib/outlookSync'

type ListFilter = 'all' | 'unread' | 'flagged'
type AccountFilter = 'all' | MailProvider
type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft'

interface ComposeDraft {
  mode: ComposeMode
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  replyToId?: string
  /** Sending account. Replies keep the account of the original message. */
  via?: MailProvider
  attachments?: OutgoingAttachment[]
}

function subjectWith(prefix: 'Re' | 'Fwd', subject: string): string {
  const trimmed = subject.trim()
  if (new RegExp(`^${prefix}:`, 'i').test(trimmed)) return trimmed
  return `${prefix}: ${trimmed}`
}

/** Reply recipients without the user's own addresses or duplicates (guide p66). */
function replyFields(message: MailMessage, selfAddresses: string[], all: boolean): { to: string; cc: string } {
  const self = new Set(selfAddresses.filter(Boolean).map((address) => normalizeEmail(address)))
  const notSelf = (address: string) => !self.has(normalizeEmail(address))
  if (!all) return { to: message.from, cc: '' }
  const tos = uniqueAddresses([message.from, ...parseAddresses(message.to)].filter(notSelf))
  const cc = uniqueAddresses(
    parseAddresses(message.cc).filter((address) => notSelf(address) && !tos.some((item) => item.toLowerCase() === address.toLowerCase())),
  )
  return { to: tos.join(', '), cc: cc.join(', ') }
}

function quoted(message: MailMessage): string {
  const text = message.body || message.preview
  return `\n\n----------\nFrom: ${message.from}\nTo: ${message.to}\nSubject: ${message.subject}\n\n${text}`
}

const FOLDER_ICONS: Record<MailFolder, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  junk: ShieldAlert,
  deleted: Trash2,
  archive: Archive,
}

function initialsOf(value: string): string {
  const name = value.replace(/<.*>/, '').replace(/^To\s+/, '').trim()
  const base = name.includes('@') ? name.split('@')[0] : name
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  return `${parts[0]?.[0] ?? '?'}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

function avatarTone(value: string): string {
  const tones = ['bg-[#0f6cbd]', 'bg-[#8764b8]', 'bg-[#038387]', 'bg-[#ca5010]', 'bg-[#4f6bed]', 'bg-[#498205]']
  let hash = 0
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return tones[hash % tones.length]
}

function senderLabel(message: MailMessage): string {
  if (message.folder === 'sent' || message.folder === 'drafts') return message.to ? `To ${message.to}` : 'No recipient'
  return message.from || 'Unknown sender'
}

const PROVIDER_NAME: Record<MailProvider, string> = { outlook: 'Outlook', gmail: 'Gmail' }

function ProviderBadge({ provider }: { provider: MailProvider }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1 text-[10px] font-semibold ${
        provider === 'gmail' ? 'bg-[#fce8e6] text-[#a50e0e]' : 'bg-[#ebf3fc] text-[#0f548c]'
      }`}
    >
      {PROVIDER_NAME[provider]}
    </span>
  )
}

export function EmailPage() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const account = normalizeEmail(email)

  const [messages, setMessages] = useState<MailMessage[]>(() => loadMailbox(email))
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<(MailSearchResult & { query: string }) | null>(null)
  const [searching, setSearching] = useState(false)
  const [composing, setComposing] = useState<ComposeDraft | null>(null)
  const [composeNote, setComposeNote] = useState<string | null>(null)
  const [pendingSend, setPendingSend] = useState<{ draft: ComposeDraft; deadline: number } | null>(null)
  const [, setTick] = useState(0)
  const [status, setStatus] = useState('Checking your mailboxes…')
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(() => lastOutlookSync(email))
  const [health, setHealthState] = useState<Partial<Record<MailProvider, ProviderHealth>>>(() => mailSyncHealth(email))
  const [outlookAddress, setOutlookAddress] = useState('')
  const [gmailOn, setGmailOn] = useState(() => isGmailConnected(account))
  const [counts, setCounts] = useState<FolderCounts>({})
  const [firstCheckDone, setFirstCheckDone] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [noOlder, setNoOlder] = useState<Record<string, boolean>>({})
  const [bodyErrors, setBodyErrors] = useState<Record<string, string>>({})
  const [bodyRetry, setBodyRetry] = useState(0)
  const [alerts, setAlerts] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [dialog, setDialog] = useState<'check' | 'shortcuts' | 'capabilities' | 'signature' | null>(null)
  const [signature, setSignature] = useState(() => loadSignature(account))
  const [calendarDraft, setCalendarDraft] = useState<MailMeetingDraft | null>(null)
  const [mobilePane, setMobilePane] = useState<'list' | 'read'>('list')
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false))
  const sendTimer = useRef<number | null>(null)
  const sendingKeys = useRef<Set<string>>(new Set())
  const searchInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const outlookOn = health.outlook ? health.outlook.state !== 'not_connected' : outlookAddress !== ''
  const anyConnected = outlookOn || gmailOn
  const bothConnected = outlookOn && gmailOn
  const gmailAddr = gmailOn ? gmailAddress(account) : ''
  const selfAddresses = useMemo(() => [account, outlookAddress, gmailAddr], [account, outlookAddress, gmailAddr])

  // ── list ──────────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const base = searchResult
      ? searchResult.messages
      : filterMailbox(messages, folder, query)
    return base.filter((message) => {
      if (accountFilter !== 'all' && mailProvider(message) !== accountFilter) return false
      if (listFilter === 'unread' && message.read) return false
      if (listFilter === 'flagged' && !message.flagged) return false
      return true
    })
  }, [messages, folder, query, searchResult, accountFilter, listFilter])

  const selected = useMemo(
    () => messages.find((message) => message.id === selectedId) ?? searchResult?.messages.find((message) => message.id === selectedId) ?? null,
    [messages, searchResult, selectedId],
  )
  const meetingSuggestion = useMemo(() => (selected ? meetingFromMail(selected) : null), [selected])
  const folderLabel = MAIL_FOLDERS.find((item) => item.id === folder)?.label ?? 'Inbox'
  const showList = !narrow || (mobilePane === 'list' && !composing)
  const showReader = !narrow || mobilePane === 'read' || Boolean(composing)

  /** Unread per folder: the provider's own count when known, otherwise the loaded mail. */
  const unreadFor = (target: MailFolder): number => {
    const providers: MailProvider[] = accountFilter === 'all' ? ['outlook', 'gmail'] : [accountFilter]
    let server = 0
    let known = false
    for (const provider of providers) {
      const value = counts[provider]?.[target]?.unread
      if (value != null) {
        server += value
        known = true
      }
    }
    if (known) return server
    return messages.filter(
      (message) => message.folder === target && !message.read && (accountFilter === 'all' || mailProvider(message) === accountFilter),
    ).length
  }

  const refreshFromStore = useCallback(() => {
    const next = loadMailbox(email)
    setMessages(next)
    setSyncedAt(lastOutlookSync(email))
    return next
  }, [email])

  const updateMessages = (change: (rows: MailMessage[]) => MailMessage[]) => {
    setMessages((prev) => {
      const next = change(prev)
      saveMailbox(email, next)
      return next
    })
  }

  // ── effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const apply = () => setNarrow(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    void ensureMsal()
    void gmailClientId().then((id) => {
      if (id) void preloadGmail()
    })
  }, [])

  const refreshCounts = useCallback(() => {
    void mailboxFolderCounts(email).then(setCounts).catch(() => undefined)
  }, [email])

  useEffect(() => {
    let lastCounts = 0
    const onSynced = (event: Event) => {
      const detail = readSyncDetail((event as CustomEvent<unknown>).detail)
      refreshFromStore()
      setStatus(detail.message)
      setSyncing(false)
      setHealthState({ ...mailSyncHealth(email) })
      setGmailOn(isGmailConnected(account))
      setFirstCheckDone(true)
      if (Date.now() - lastCounts > 30_000) {
        lastCounts = Date.now()
        refreshCounts()
      }
    }
    window.addEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
  }, [email, account, refreshFromStore, refreshCounts])

  // A new login on this device starts clean, with only that person's mail (guide p26, p75).
  useEffect(() => {
    setMessages(loadMailbox(email))
    setSyncedAt(lastOutlookSync(email))
    setSelectedId(null)
    setChecked(new Set())
    setFolder('inbox')
    setAccountFilter('all')
    setMobilePane('list')
    setQuery('')
    setSearchResult(null)
    setNoOlder({})
    setGmailOn(isGmailConnected(account))
    setSignature(loadSignature(account))
    const saved = loadComposeLocally<ComposeDraft>(account)
    if (saved?.draft) {
      setComposing(saved.draft)
      setComposeNote(`Unsent message restored from ${new Date(saved.savedAt).toLocaleString()}. Attachments are not kept on this device; attach them again.`)
    } else {
      setComposing(null)
    }
    if (!email) return
    setSyncing(true)
    setStatus(`Checking mail for ${account}…`)
    void syncOutlookNow(email, { incremental: false, mail: true })
    refreshCounts()
  }, [email, account, refreshCounts])

  useEffect(() => {
    if (!outlookOn) {
      setOutlookAddress('')
      return
    }
    let cancel = false
    void connectedMailboxAddress().then((address) => !cancel && setOutlookAddress(address))
    return () => {
      cancel = true
    }
  }, [outlookOn, account])

  // Near-instant mail while this page is open and visible.
  useEffect(() => {
    const syncSurface = () => setOutlookMailSurfaceActive(document.visibilityState !== 'hidden')
    syncSurface()
    document.addEventListener('visibilitychange', syncSurface)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void syncOutlookNow(email, { incremental: true, mail: true })
    }, OUTLOOK_VISIBLE_SYNC_MS)
    return () => {
      setOutlookMailSurfaceActive(false)
      document.removeEventListener('visibilitychange', syncSurface)
      window.clearInterval(timer)
    }
  }, [email])

  // Composer autosave on this device (guide p65). Attachments are not stored.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!composing) {
        saveComposeLocally(account, null)
        return
      }
      const empty = !composing.to.trim() && !composing.subject.trim() && !composing.body.replace(/\s|--/g, '').trim()
      saveComposeLocally(account, empty ? null : { ...composing, attachments: undefined })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [composing, account])

  // Undo send countdown and leave-page guard.
  useEffect(() => {
    if (!pendingSend) return
    const tick = window.setInterval(() => setTick((n) => n + 1), 500)
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('beforeunload', guard)
    }
  }, [pendingSend])

  // Full message on open; a failure is shown, not hidden (guide p59).
  useEffect(() => {
    const message = selected
    if (!message || message.demo || message.pending || message.bodyLoaded) return
    let cancel = false
    void (async () => {
      try {
        if (isGmailId(message.id)) {
          const full = await getGmailMessage(account, message.id, message.folder)
          if (cancel) return
          if (!full) throw new Error('Gmail did not return this message. Reconnect Gmail if this keeps happening.')
          updateMessages((rows) => rows.map((row) => (row.id === full.id ? { ...row, ...full, folder: row.folder } : row)))
          if (searchResult) setSearchResult((prev) => prev && { ...prev, messages: prev.messages.map((row) => (row.id === full.id ? { ...row, ...full } : row)) })
        } else {
          const token = await outlookToken(false)
          if (cancel) return
          if (!token) throw new Error('Outlook is not connected.')
          const full = await getOutlookMessage(token, message.id, message.folder)
          if (cancel) return
          if (!full) throw new Error('Outlook did not return this message. It may have been moved or deleted.')
          const attachments = full.hasAttachments ? await listOutlookAttachments(token, message.id) : []
          if (cancel) return
          const merged = { ...full, attachments, bodyLoaded: true }
          updateMessages((rows) => rows.map((row) => (row.id === full.id ? { ...row, ...merged, folder: row.folder } : row)))
          if (searchResult) setSearchResult((prev) => prev && { ...prev, messages: prev.messages.map((row) => (row.id === full.id ? { ...row, ...merged } : row)) })
        }
        setBodyErrors((prev) => {
          if (!prev[message.id]) return prev
          const next = { ...prev }
          delete next[message.id]
          return next
        })
      } catch (err) {
        if (!cancel) setBodyErrors((prev) => ({ ...prev, [message.id]: err instanceof Error ? err.message : 'Unknown error.' }))
      }
    })()
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.bodyLoaded, account, bodyRetry])

  // ── actions ───────────────────────────────────────────────────────────────
  // Open a message requested from the notification bell (?open=<id>); opening marks it read.
  const [params, setParams] = useSearchParams()
  const openParam = params.get('open')
  useEffect(() => {
    if (!openParam) return
    const message = messages.find((row) => row.id === openParam)
    if (!message) return
    setFolder(message.folder)
    setSearchResult(null)
    openMessage(message)
    const next = new URLSearchParams(params)
    next.delete('open')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, messages])

  const openMessage = (message: MailMessage) => {
    setComposing(null)
    setSelectedId(message.id)
    setMobilePane('read')
    if (message.read) return
    updateMessages((rows) => rows.map((row) => (row.id === message.id ? { ...row, read: true } : row)))
    void pushMailRead(message.id, true).catch(() => {
      // The provider refused: put the row back so the screen matches the mailbox (guide p60).
      updateMessages((rows) => rows.map((row) => (row.id === message.id ? { ...row, read: false } : row)))
      setStatus(`${PROVIDER_NAME[mailProvider(message)]} did not confirm the read state.`)
    })
  }

  const setRead = (ids: string[], read: boolean) => {
    const before = new Map(messages.filter((row) => ids.includes(row.id)).map((row) => [row.id, row.read]))
    updateMessages((rows) => rows.map((row) => (ids.includes(row.id) ? { ...row, read } : row)))
    void Promise.allSettled(ids.map((id) => pushMailRead(id, read))).then((results) => {
      const failed = ids.filter((_, index) => results[index].status === 'rejected')
      if (failed.length) {
        updateMessages((rows) => rows.map((row) => (failed.includes(row.id) ? { ...row, read: before.get(row.id) ?? row.read } : row)))
      }
      setStatus(failed.length ? `${ids.length - failed.length} updated, ${failed.length} not updated by the provider.` : `${ids.length} message${ids.length > 1 ? 's' : ''} marked ${read ? 'read' : 'unread'}.`)
    })
  }

  const setFlag = (ids: string[], flagged: boolean) => {
    updateMessages((rows) => rows.map((row) => (ids.includes(row.id) ? { ...row, flagged } : row)))
    void Promise.allSettled(ids.map((id) => pushMailFlag(id, flagged))).then((results) => {
      const failed = ids.filter((_, index) => results[index].status === 'rejected')
      if (failed.length) updateMessages((rows) => rows.map((row) => (failed.includes(row.id) ? { ...row, flagged: !flagged } : row)))
      setStatus(failed.length ? `${failed.length} could not be ${flagged ? 'flagged' : 'unflagged'}.` : flagged ? 'Flagged (Outlook) / starred (Gmail).' : 'Flag removed.')
    })
  }

  /** Move with a result per message; failures go back where they were (guide p61, p73). */
  const moveTo = (ids: string[], target: MailFolder) => {
    if (!ids.length) return
    const snapshot = loadMailbox(email)
    let next = snapshot
    for (const id of ids) next = relocateMessage(next, id, target)
    setMessages(next)
    saveMailbox(email, next)
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(null)
      setMobilePane('list')
    }
    setChecked(new Set())
    const label = MAIL_FOLDERS.find((item) => item.id === target)?.label ?? target
    void Promise.allSettled(ids.map((id) => pushMailMoveTo(id, target))).then((results) => {
      const failed = ids.filter((_, index) => results[index].status === 'rejected')
      if (failed.length) {
        const restore = new Map(snapshot.filter((row) => failed.includes(row.id)).map((row) => [row.id, row.folder]))
        updateMessages((rows) => rows.map((row) => (restore.has(row.id) ? { ...row, folder: restore.get(row.id) as MailFolder } : row)))
        setStatus(`${ids.length - failed.length} moved to ${label}. ${failed.length} could not be moved and are back where they were.`)
      } else {
        setStatus(`${ids.length} message${ids.length > 1 ? 's' : ''} moved to ${label}.`)
      }
      refreshCounts()
    })
  }

  const runServerSearch = () => {
    const q = query.trim()
    if (!q) return
    if (!anyConnected) {
      setStatus('Connect Outlook or Gmail to search the whole mailbox.')
      return
    }
    setSearching(true)
    setStatus(`Searching ${bothConnected ? 'Outlook and Gmail' : outlookOn ? 'Outlook' : 'Gmail'} for "${q}"…`)
    void searchMailboxes(email, q)
      .then((result) => {
        setSearchResult({ ...result, query: q })
        setSelectedId(null)
        const failed = result.failed.map((row) => `${PROVIDER_NAME[row.provider]}: ${row.error}`).join(' ')
        setStatus(`${result.messages.length} result${result.messages.length === 1 ? '' : 's'} from ${result.searched.map((p) => PROVIDER_NAME[p]).join(' and ') || 'no mailbox'}.${failed ? ` ${failed}` : ''}`)
      })
      .finally(() => setSearching(false))
  }

  const clearSearch = () => {
    setSearchResult(null)
    setQuery('')
    setSelectedId(null)
  }

  const loadOlder = () => {
    setLoadingOlder(true)
    loadOlderMail(email, folder)
      .then((added) => {
        refreshFromStore()
        if (added === 0) setNoOlder((prev) => ({ ...prev, [folder]: true }))
        setStatus(added ? `Loaded ${added} older emails.` : 'No older emails in this folder.')
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : 'Older emails could not be loaded.'))
      .finally(() => setLoadingOlder(false))
  }

  const turnOnAlerts = () => {
    if (typeof Notification === 'undefined') return
    void Notification.requestPermission().then((result) => {
      setAlerts(result)
      setStatus(result === 'granted' ? 'Desktop alerts are on. New mail shows even when this window is in the background.' : 'Desktop alerts stay off.')
    })
  }

  const connectOutlook = () => {
    setSyncing(true)
    setStatus('Opening Microsoft to connect Outlook…')
    void outlookToken(true, email).then((token) => {
      if (!token) {
        setSyncing(false)
        setStatus(graphTokenError() ?? `Outlook sign-in did not finish for ${account}.`)
        return
      }
      void syncOutlookNow(email, { incremental: false, mail: true })
    })
  }

  const switchOutlookAccount = () => {
    setStatus('Opening Microsoft to pick a different account…')
    void disconnectOutlookMailbox().then(() => {
      const kept = loadMailbox(email).filter((message) => mailProvider(message) !== 'outlook' || message.pending)
      saveMailbox(email, kept)
      setMessages(kept)
      setSelectedId(null)
      setOutlookAddress('')
      connectOutlook()
    })
  }

  const connectGmailNow = () => {
    setSyncing(true)
    const renewing = gmailNeedsRenewal(account)
    setStatus(renewing ? 'Reconnecting Gmail…' : 'Connecting Gmail…')
    const known = rememberedGmail(account)
    connectGmail(account, known.includes('@') ? known : email)
      .then((address) => {
        setGmailOn(true)
        // Show the whole inbox right away: Inbox folder, every account, no filters.
        setFolder('inbox')
        setListFilter('all')
        setAccountFilter('all')
        setQuery('')
        setSearchResult(null)
        setSelectedId(null)
        setMobilePane('list')
        setStatus(`Gmail connected${address ? ` (${address})` : ''}. Syncing your inbox and every folder…`)
        void syncOutlookNow(email, { incremental: false, mail: true })
        refreshCounts()
      })
      .catch((err) => {
        setSyncing(false)
        setStatus(err instanceof GmailSetupError || err instanceof Error ? err.message : 'Google did not connect Gmail.')
      })
  }

  const disconnectGmailNow = () => {
    disconnectGmail(account)
    setGmailOn(false)
    const kept = loadMailbox(email).filter((message) => !isGmailId(message.id))
    saveMailbox(email, kept)
    setMessages(kept)
    setSelectedId(null)
    if (accountFilter === 'gmail') setAccountFilter('all')
    setStatus('Gmail disconnected. Its mail was removed from this device.')
    void syncOutlookNow(email, { incremental: false, mail: true })
  }

  const syncNow = () => {
    // Gmail tokens last one hour. If it expired, this click renews it, then syncs.
    if (gmailNeedsRenewal(account)) {
      connectGmailNow()
      return
    }
    setSyncing(true)
    setStatus('Refreshing every connected mailbox…')
    void syncOutlookNow(email, { incremental: false, mail: true })
    refreshCounts()
  }

  // ── composer ──────────────────────────────────────────────────────────────
  const defaultVia = (replyToId?: string): MailProvider =>
    replyToId && !isLocalMailId(replyToId)
      ? mailProvider({ id: replyToId })
      : // A Microsoft account that signs in with a Gmail address has no real Outlook mail;
        // when Gmail is connected, new mail goes out from Gmail.
        gmailOn && (!outlookOn || /@gmail\.com$/i.test(outlookAddress))
        ? 'gmail'
        : outlookOn
          ? 'outlook'
          : 'outlook'

  const startCompose = (draft: ComposeDraft) => {
    setComposeNote(null)
    const via = draft.via ?? defaultVia(draft.replyToId)
    const body = draft.mode === 'draft' ? draft.body : withSignature(draft.body, signature)
    setComposing({ ...draft, via, body })
    setMobilePane('read')
  }

  // Start a new message from a link elsewhere in the CRM (?to=<address>&subject=<text>),
  // so contact emails open the built-in composer instead of an outside mail app.
  const toParam = params.get('to')
  useEffect(() => {
    if (!toParam) return
    startCompose({ mode: 'new', to: toParam, cc: '', bcc: '', subject: params.get('subject') ?? '', body: '' })
    const next = new URLSearchParams(params)
    next.delete('to')
    next.delete('subject')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toParam])

  const reply = (message: MailMessage, all: boolean) =>
    startCompose({ mode: all ? 'replyAll' : 'reply', ...replyFields(message, selfAddresses, all), bcc: '', subject: subjectWith('Re', message.subject), body: '', replyToId: message.id })
  const forward = (message: MailMessage) =>
    startCompose({ mode: 'forward', to: '', cc: '', bcc: '', subject: subjectWith('Fwd', message.subject), body: quoted(message), replyToId: message.id })

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || !composing) return
    void Promise.all(files.map(readAttachment))
      .then((read) => {
        setComposing((prev) => {
          if (!prev) return prev
          const attachments = [...(prev.attachments ?? []), ...read]
          const problem = attachmentProblem(attachments, prev.via ?? 'outlook')
          if (problem) {
            setStatus(problem)
            return prev
          }
          return { ...prev, attachments }
        })
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : 'That file could not be attached.'))
  }

  /** Checks before sending (guide p65): recipients, addresses, attachment size. */
  const composeProblem = (draft: ComposeDraft): string | null => {
    const needsRecipient = draft.mode === 'new' || draft.mode === 'forward' || draft.mode === 'draft'
    if (needsRecipient && !draft.to.trim()) return 'Enter at least one recipient.'
    const bad = [...invalidAddresses(draft.to), ...invalidAddresses(draft.cc), ...invalidAddresses(draft.bcc)]
    if (bad.length) return `Check these addresses: ${bad.join(', ')}`
    if ((draft.mode === 'reply' || draft.mode === 'replyAll') && !draft.body.replace(/--\s*\n[\s\S]*$/, '').trim() && !draft.attachments?.length) return 'Write a reply before sending.'
    const via = draft.via ?? 'outlook'
    if (via === 'gmail' && !gmailOn) return 'Gmail is not connected. Connect Gmail or send from Outlook.'
    if (via === 'outlook' && !outlookOn) return 'Outlook is not connected. Connect Outlook or send from Gmail.'
    if (draft.attachments?.length) return attachmentProblem(draft.attachments, via)
    return null
  }

  /** Hand the message to the provider once. Repeat clicks never send twice (guide p68). */
  const dispatch = (draft: ComposeDraft) => {
    const opKey = `${draft.via}|${draft.to}|${draft.subject}|${draft.body.length}|${draft.replyToId ?? ''}`
    if (sendingKeys.current.has(opKey)) return
    sendingKeys.current.add(opKey)
    const release = () => window.setTimeout(() => sendingKeys.current.delete(opKey), 4000)
    const via = draft.via ?? 'outlook'
    const fromAddress = via === 'gmail' ? gmailAddr || account : outlookAddress || account

    if (draft.mode === 'draft' && draft.replyToId && !draft.attachments?.length) {
      const existing = messages.find((message) => message.id === draft.replyToId)
      const message: MailMessage = {
        ...(existing ?? makePendingSent({ from: account, to: draft.to, subject: draft.subject, body: draft.body })),
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject.trim() || '(no subject)',
        body: draft.body,
        folder: 'drafts',
        demo: existing?.demo ?? true,
      }
      setFolder('sent')
      const edited = !existing || existing.to !== draft.to || existing.subject !== draft.subject || existing.body !== draft.body || (existing.cc ?? '') !== draft.cc || (existing.bcc ?? '') !== draft.bcc
      // An edited draft is saved to the provider first, so the provider sends what is on screen.
      const ready = edited && existing && !existing.demo
        ? saveDraftMail({ email, id: draft.replyToId, to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body: draft.body, via }).then((saved) => {
            if (saved.demo) throw new Error('The edited draft could not be saved to the provider, so it was not sent.')
            return saved
          })
        : Promise.resolve(message)
      void ready
        .then((toSend) => sendDraftMail(email, toSend))
        .then(() => {
          refreshFromStore()
          setStatus(`Sent from ${fromAddress} through ${PROVIDER_NAME[via]}. It appears in Sent once ${PROVIDER_NAME[via]} lists it.`)
          void syncOutlookNow(email, { incremental: true, mail: true })
        })
        .catch((err) => setStatus(err instanceof Error ? err.message : 'The draft was not sent.'))
        .finally(release)
      return
    }

    const pending = makePendingSent({ from: fromAddress, to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body: draft.body })
    setFolder('sent')
    setSelectedId(pending.id)
    updateMessages((rows) => mergeMailbox(rows, { incoming: [pending] }))
    void deliverMail({
      email,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      replyToId: draft.mode === 'new' || draft.mode === 'draft' ? undefined : draft.replyToId,
      action: draft.mode === 'reply' || draft.mode === 'replyAll' || draft.mode === 'forward' ? draft.mode : 'send',
      skipGraph: draft.replyToId ? isLocalMailId(draft.replyToId) : false,
      via,
      attachments: draft.attachments,
    })
      .then(() => {
        // Accepted by the provider. "Sent" is confirmed when the provider lists it (guide p70).
        setStatus(`Accepted by ${PROVIDER_NAME[via]} from ${fromAddress}. It appears in Sent once ${PROVIDER_NAME[via]} lists it.`)
        void syncOutlookNow(email, { incremental: true, mail: true })
      })
      .catch((err) => {
        updateMessages((rows) => rows.filter((message) => message.id !== pending.id))
        setComposing(draft)
        setMobilePane('read')
        setStatus(`${err instanceof Error ? err.message : 'The message was not sent.'} Your message is back in the composer.`)
      })
      .finally(release)
  }

  const sendCurrent = () => {
    if (!composing || pendingSend) return
    const problem = composeProblem(composing)
    if (problem) {
      setStatus(problem)
      return
    }
    const draft = composing
    setComposing(null)
    saveComposeLocally(account, null)
    setMobilePane('list')
    // Undo window before anything is handed to the provider (guide p69).
    setPendingSend({ draft, deadline: Date.now() + UNDO_SEND_MS })
    sendTimer.current = window.setTimeout(() => {
      sendTimer.current = null
      setPendingSend(null)
      dispatch(draft)
    }, UNDO_SEND_MS)
  }

  const undoSend = () => {
    if (!pendingSend) return
    if (sendTimer.current) window.clearTimeout(sendTimer.current)
    sendTimer.current = null
    setComposing(pendingSend.draft)
    setPendingSend(null)
    setMobilePane('read')
    setStatus('Sending cancelled. Nothing was sent.')
  }

  const sendNowFromToast = () => {
    if (!pendingSend) return
    if (sendTimer.current) window.clearTimeout(sendTimer.current)
    sendTimer.current = null
    const draft = pendingSend.draft
    setPendingSend(null)
    dispatch(draft)
  }

  const saveDraft = () => {
    if (!composing) return
    const draft = composing
    void saveDraftMail({
      email,
      id: draft.mode === 'draft' ? draft.replyToId : undefined,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      localOnly: Boolean(draft.replyToId && isLocalMailId(draft.replyToId)),
      via: draft.via,
    }).then((saved) => {
      refreshFromStore()
      setFolder('drafts')
      setSelectedId(saved.id)
      setComposing(null)
      saveComposeLocally(account, null)
      setMobilePane('read')
      setStatus(
        saved.demo
          ? 'Draft kept on this device only. The mail provider did not save it.'
          : `Draft saved in ${PROVIDER_NAME[draft.via ?? 'outlook']}.${draft.attachments?.length ? ' Attachments are not saved with drafts; attach them before sending.' : ''}`,
      )
    })
  }

  const discardCompose = () => {
    if (composing && (composing.body.replace(/--\s*\n[\s\S]*$/, '').trim() || composing.attachments?.length) && !window.confirm('Discard this message?')) return
    setComposing(null)
    setComposeNote(null)
    saveComposeLocally(account, null)
  }

  const downloadFile = (message: MailMessage, file: MailAttachment) => {
    void (async () => {
      try {
        if (isGmailId(message.id)) {
          await downloadGmailAttachment(account, message.id, file)
          return
        }
        const token = await outlookToken(false)
        if (!token) throw new Error(`Connect Outlook to download ${file.name}.`)
        await downloadOutlookAttachment(token, message.id, file)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'That file could not be downloaded.')
      }
    })()
  }

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ── keyboard (guide p74) ──────────────────────────────────────────────────
  const keyState = useRef({ visible, selected, composing, dialog, checked, actions: { openMessage, startCompose, reply, forward, moveTo, setRead, setFlag, toggleChecked } })
  keyState.current = { visible, selected, composing, dialog, checked, actions: { openMessage, startCompose, reply, forward, moveTo, setRead, setFlag, toggleChecked } }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = keyState.current
      const { openMessage, startCompose, reply, forward, moveTo, setRead, setFlag, toggleChecked } = state.actions
      if (event.key === 'Escape') {
        if (state.composing) return
        if (state.checked.size) setChecked(new Set())
        return
      }
      if (state.dialog || state.composing || isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const list = state.visible
      const current = state.selected
      const index = current ? list.findIndex((row) => row.id === current.id) : -1
      const key = event.key
      const go = (delta: number) => {
        const row = list[Math.min(list.length - 1, Math.max(0, index + delta))]
        if (row) openMessage(row)
      }
      const handled = () => event.preventDefault()
      if (key === 'j' || key === 'ArrowDown') return handled(), go(1)
      if (key === 'k' || key === 'ArrowUp') return handled(), go(-1)
      if (key === 'Enter' && !current && list[0]) return handled(), openMessage(list[0])
      if (key === 'n') return handled(), startCompose({ mode: 'new', to: '', cc: '', bcc: '', subject: '', body: '' })
      if (key === '/') return handled(), searchInput.current?.focus()
      if (key === '?') return handled(), setDialog('shortcuts')
      if (!current) return
      if (key === 'r') return handled(), reply(current, false)
      if (key === 'a') return handled(), reply(current, true)
      if (key === 'f') return handled(), forward(current)
      if (key === 'e') return handled(), moveTo([current.id], 'archive')
      if (key === 'Delete' || key === '#') return handled(), moveTo([current.id], 'deleted')
      if (key === 'u') return handled(), setRead([current.id], !current.read)
      if (key === 's') return handled(), setFlag([current.id], !current.flagged)
      if (key === 'x') return handled(), toggleChecked(current.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── render ────────────────────────────────────────────────────────────────
  const ribbonButton =
    'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-[#242424] hover:bg-[#f0f0f0] disabled:text-[#a0a0a0] disabled:hover:bg-transparent'
  const checkedIds = [...checked]
  const firstSync = anyConnected && messages.length === 0 && Object.values(health).some((row) => row?.state === 'loading')
  const failures = (Object.entries(health) as [MailProvider, ProviderHealth | undefined][]).filter(([, row]) => row?.state === 'failed')
  const secondsLeft = pendingSend ? Math.max(0, Math.ceil((pendingSend.deadline - Date.now()) / 1000)) : 0

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f5f5] text-[#242424]" data-testid="outlook-home">
      {/* App bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 bg-[#0f6cbd] px-3 text-white sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Mail className="h-5 w-5" />
          <h1 className="text-base font-semibold">{bothConnected ? 'Mail' : gmailOn ? 'Gmail' : 'Outlook'}</h1>
        </div>
        <form
          className="relative mx-auto w-full max-w-xl"
          onSubmit={(event) => {
            event.preventDefault()
            runServerSearch()
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#0f6cbd]" />
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              if (!event.target.value) setSearchResult(null)
            }}
            placeholder="Search mail (Enter searches the whole mailbox)"
            data-testid="email-search"
            aria-label="Search mail"
            className="h-8 w-full rounded-md bg-[#ebf3fc] pr-3 pl-9 text-sm text-[#242424] outline-none placeholder:text-[#616161] focus:bg-white"
          />
        </form>
        <button type="button" onClick={syncNow} disabled={syncing} aria-label="Sync mail" title="Sync mail" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/15">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold sm:inline-flex" title={account}>
          {initialsOf(account || 'Me')}
        </span>
      </header>

      {!online && (
        <div role="status" className="flex shrink-0 items-center gap-2 bg-[#fff4ce] px-4 py-1.5 text-xs text-[#5c4300]">
          <WifiOff className="h-4 w-4" /> You are offline. Showing mail saved on this device; it may be out of date. Sending waits until you reconnect.
        </div>
      )}
      {failures.length > 0 && online && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 bg-[#fdf3f4] px-4 py-1.5 text-xs text-[#a4262c]">
          <ShieldAlert className="h-4 w-4" />
          {failures.map(([provider, row]) => `${PROVIDER_NAME[provider]}: ${row?.error ?? 'sync failed'}`).join(' · ')} Saved mail stays on screen.
          <button type="button" onClick={() => setDialog('check')} className="font-semibold underline">
            Check mailbox
          </button>
        </div>
      )}

      {/* Command ribbon */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#e0e0e0] bg-white px-2 py-1.5 sm:px-3">
        <button
          type="button"
          data-testid="email-compose"
          onClick={() => startCompose({ mode: 'new', to: '', cc: '', bcc: '', subject: '', body: '' })}
          className="mr-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-3 text-sm font-semibold text-white hover:bg-[#115ea3]"
        >
          <PenSquare className="h-4 w-4" />
          New mail
        </button>
        {checkedIds.length > 0 ? (
          <>
            <span className="px-1 text-sm font-semibold" data-testid="email-bulk-count">
              {checkedIds.length} selected
            </span>
            <button type="button" className={ribbonButton} onClick={() => setRead(checkedIds, true)}>
              <MailOpen className="h-4 w-4" /> Mark read
            </button>
            <button type="button" className={ribbonButton} onClick={() => setRead(checkedIds, false)}>
              <Mail className="h-4 w-4" /> Mark unread
            </button>
            <button type="button" className={ribbonButton} onClick={() => setFlag(checkedIds, true)}>
              <Flag className="h-4 w-4" /> Flag
            </button>
            <button type="button" className={ribbonButton} onClick={() => moveTo(checkedIds, 'archive')}>
              <Archive className="h-4 w-4" /> Archive
            </button>
            <button type="button" className={ribbonButton} onClick={() => moveTo(checkedIds, 'deleted')}>
              <Trash className="h-4 w-4" /> Delete
            </button>
            <button type="button" className={ribbonButton} onClick={() => setChecked(new Set())}>
              <X className="h-4 w-4" /> Clear
            </button>
          </>
        ) : (
          <>
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && moveTo([selected.id], 'deleted')}>
              <Trash className="h-4 w-4" /> Delete
            </button>
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && moveTo([selected.id], 'archive')}>
              <Archive className="h-4 w-4" /> Archive
            </button>
            {selected && (selected.folder === 'deleted' || selected.folder === 'archive') && (
              <button type="button" data-testid="email-restore" className={ribbonButton} onClick={() => moveTo([selected.id], 'inbox')}>
                <ArchiveRestore className="h-4 w-4" /> Move to Inbox
              </button>
            )}
            {selected?.folder === 'junk' ? (
              <button type="button" data-testid="email-not-junk" className={ribbonButton} onClick={() => moveTo([selected.id], 'inbox')}>
                <ShieldCheck className="h-4 w-4" /> Not junk
              </button>
            ) : (
              <button type="button" className={ribbonButton} disabled={!selected || selected.folder === 'sent' || selected.folder === 'drafts'} onClick={() => selected && moveTo([selected.id], 'junk')}>
                <ShieldAlert className="h-4 w-4" /> Junk
              </button>
            )}
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && setRead([selected.id], !selected.read)}>
              {selected && !selected.read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {selected && !selected.read ? 'Mark read' : 'Mark unread'}
            </button>
            <button type="button" data-testid="email-flag" className={ribbonButton} disabled={!selected} onClick={() => selected && setFlag([selected.id], !selected.flagged)}>
              <Flag className={`h-4 w-4 ${selected?.flagged ? 'fill-[#c50f1f] text-[#c50f1f]' : ''}`} />
              {selected?.flagged ? 'Unflag' : selected && mailProvider(selected) === 'gmail' ? 'Star' : 'Flag'}
            </button>
            <span className="mx-1 hidden h-5 w-px bg-[#e0e0e0] sm:inline-block" />
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && reply(selected, false)}>
              <Reply className="h-4 w-4" /> Reply
            </button>
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && reply(selected, true)}>
              <ReplyAll className="h-4 w-4" /> Reply all
            </button>
            <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && forward(selected)}>
              <Forward className="h-4 w-4" /> Forward
            </button>
            <button type="button" data-testid="email-add-to-calendar" className={ribbonButton} disabled={!selected} onClick={() => meetingSuggestion && setCalendarDraft(meetingSuggestion)}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </button>
          </>
        )}

        {/* Connected accounts */}
        <span className="ml-auto inline-flex flex-wrap items-center gap-2 text-xs text-[#616161]">
          {outlookOn ? (
            <span className="inline-flex items-center gap-1.5">
              <ProviderBadge provider="outlook" /> {outlookAddress || 'connected'}
              <button type="button" data-testid="email-outlook-switch" onClick={switchOutlookAccount} className="h-7 rounded-md border border-[#e0e0e0] px-2 font-semibold text-[#242424] hover:bg-[#f5f5f5]">
                Switch
              </button>
            </span>
          ) : (
            <button type="button" data-testid="email-connect" onClick={connectOutlook} className="inline-flex h-8 items-center rounded-md border border-[#0f6cbd] px-3 text-sm font-semibold text-[#0f6cbd] hover:bg-[#ebf3fc]">
              Connect Outlook
            </button>
          )}
          {gmailOn ? (
            <span className="inline-flex items-center gap-1.5">
              <ProviderBadge provider="gmail" /> {gmailAddr || 'connected'}
              <button type="button" data-testid="email-gmail-disconnect" onClick={disconnectGmailNow} className="h-7 rounded-md border border-[#e0e0e0] px-2 font-semibold text-[#242424] hover:bg-[#f5f5f5]">
                Disconnect
              </button>
            </span>
          ) : (
            <button type="button" data-testid="email-connect-gmail" onClick={connectGmailNow} className="inline-flex h-8 items-center rounded-md border border-[#c5221f] px-3 text-sm font-semibold text-[#c5221f] hover:bg-[#fce8e6]">
              {gmailNeedsRenewal(account) ? 'Reconnect Gmail' : 'Connect Gmail'}
            </button>
          )}
          <button type="button" title="Mailbox check" aria-label="Mailbox check" data-testid="email-check" onClick={() => setDialog('check')} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f0f0f0]">
            <Stethoscope className="h-4 w-4 text-[#424242]" />
          </button>
          <button type="button" title="Signature" aria-label="Signature" onClick={() => setDialog('signature')} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f0f0f0]">
            <PenSquare className="h-4 w-4 text-[#424242]" />
          </button>
          <button type="button" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={() => setDialog('shortcuts')} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f0f0f0]">
            <Keyboard className="h-4 w-4 text-[#424242]" />
          </button>
          <button type="button" title="What this inbox supports" aria-label="What this inbox supports" onClick={() => setDialog('capabilities')} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f0f0f0]">
            <HelpCircle className="h-4 w-4 text-[#424242]" />
          </button>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(280px,380px)_minmax(0,1fr)]">
        {/* Folder pane */}
        {showList && (
          <nav aria-label="Mail folders" className="flex min-h-0 gap-1 overflow-x-auto border-b border-[#e0e0e0] bg-[#f5f5f5] p-2 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2 lg:py-3">
            {bothConnected && (
              <div className="hidden px-1 pb-2 lg:block" role="group" aria-label="Account">
                <p className="px-2 pb-1 text-xs font-semibold text-[#616161]">Account</p>
                {(['all', 'outlook', 'gmail'] as AccountFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`email-account-${value}`}
                    onClick={() => setAccountFilter(value)}
                    className={`flex h-8 w-full items-center rounded-md px-3 text-left text-sm ${accountFilter === value ? 'bg-[#e6eef8] font-semibold text-[#0f6cbd]' : 'hover:bg-[#ebebeb]'}`}
                  >
                    {value === 'all' ? 'All accounts' : value === 'outlook' ? outlookAddress || 'Outlook' : gmailAddr || 'Gmail'}
                  </button>
                ))}
              </div>
            )}
            {MAIL_FOLDERS.map((item) => {
              const count = unreadFor(item.id)
              const Icon = FOLDER_ICONS[item.id]
              const active = folder === item.id && !searchResult
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`email-folder-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setFolder(item.id)
                    setSearchResult(null)
                    setChecked(new Set())
                    setMobilePane('list')
                  }}
                  className={`relative flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm lg:w-full ${active ? 'bg-[#e6eef8] font-semibold text-[#0f6cbd]' : 'text-[#242424] hover:bg-[#ebebeb]'}`}
                >
                  {active && <span className="absolute top-2 bottom-2 left-0 hidden w-0.5 rounded bg-[#0f6cbd] lg:block" />}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count > 0 && (
                    <span className="text-xs font-semibold text-[#0f6cbd]">
                      {count}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {/* Message list */}
        {showList && (
          <div className="flex min-h-0 flex-col border-b border-[#e0e0e0] bg-white lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-2 border-b border-[#e0e0e0] px-4 pt-3 pb-2">
              <h2 className="text-base font-semibold">{searchResult ? 'Search results' : folderLabel}</h2>
              <div className="flex rounded-md bg-[#f5f5f5] p-0.5 text-xs" role="group" aria-label="Filter">
                {(['all', 'unread', 'flagged'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`email-filter-${value}`}
                    aria-pressed={listFilter === value}
                    onClick={() => setListFilter(value)}
                    className={`h-6 rounded px-2.5 font-semibold capitalize ${listFilter === value ? 'bg-white text-[#0f6cbd] shadow-sm' : 'text-[#616161]'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {searchResult && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e0e0] bg-[#ebf3fc] px-4 py-2 text-xs text-[#0f548c]" data-testid="email-search-banner">
                <span className="flex-1">
                  Server search for “{searchResult.query}” in {searchResult.searched.map((p) => PROVIDER_NAME[p]).join(' and ') || 'no mailbox'} (newest 25 per account, all folders).
                  {searchResult.failed.length > 0 && ` ${searchResult.failed.map((row) => `${PROVIDER_NAME[row.provider]} search failed.`).join(' ')}`}
                </span>
                <button type="button" onClick={clearSearch} className="font-semibold underline">
                  Back to {folderLabel}
                </button>
              </div>
            )}
            {!searchResult && query.trim() && anyConnected && (
              <button type="button" onClick={runServerSearch} disabled={searching} className="flex items-center gap-2 border-b border-[#e0e0e0] px-4 py-2 text-left text-xs font-semibold text-[#0f6cbd] hover:bg-[#f5f5f5]" data-testid="email-server-search">
                <Search className="h-3.5 w-3.5" />
                {searching ? 'Searching…' : `Showing loaded mail only. Search all of ${bothConnected ? 'Outlook and Gmail' : outlookOn ? 'Outlook' : 'Gmail'} for “${query.trim()}”`}
              </button>
            )}

            {!anyConnected && firstCheckDone && (
              <div data-testid="outlook-not-connected" className="border-b border-[#e0e0e0] bg-[#fff8e6] px-4 py-3 text-xs text-[#7a5b00]">
                <p className="font-semibold">No mailbox connected</p>
                <p className="mt-1">
                  No mail has been retrieved for {account}. Connect Outlook for a Microsoft mailbox (work, school, or Outlook.com) or Gmail for a Google
                  mailbox. You approve mail access on the provider’s own page the first time.
                </p>
                {graphTokenError() && <p className="mt-1">Last error: {graphTokenError()}</p>}
                <button type="button" onClick={connectOutlook} className="mt-2 inline-flex h-7 items-center rounded-md bg-[#0f6cbd] px-3 font-semibold text-white hover:bg-[#115ea3]">
                  Connect Outlook
                </button>
                <button type="button" onClick={connectGmailNow} className="mt-2 ml-2 inline-flex h-7 items-center rounded-md bg-[#c5221f] px-3 font-semibold text-white hover:bg-[#a50e0e]">
                  Connect Gmail
                </button>
              </div>
            )}

            <ul className="custom-scroll min-h-0 flex-1 overflow-y-auto" aria-label={`${searchResult ? 'Search results' : folderLabel} messages`} data-mail-list>
              {visible.map((message) => {
                const label = senderLabel(message)
                const active = selectedId === message.id
                const isChecked = checked.has(message.id)
                const provider = mailProvider(message)
                return (
                  <li key={message.id} className={`relative flex border-b border-[#f0f0f0] ${active ? 'bg-[#e6eef8]' : isChecked ? 'bg-[#f3f8fd]' : 'hover:bg-[#f5f5f5]'}`}>
                    {!message.read && <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-[#0f6cbd]" />}
                    <button
                      type="button"
                      aria-label={isChecked ? `Deselect ${message.subject}` : `Select ${message.subject}`}
                      aria-pressed={isChecked}
                      onClick={() => toggleChecked(message.id)}
                      className="flex w-9 shrink-0 items-start justify-center pt-3 text-[#616161]"
                      data-testid={`email-check-${message.id}`}
                    >
                      {isChecked ? <CheckSquare className="h-4 w-4 text-[#0f6cbd]" /> : <Square className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      data-testid={`email-row-${message.id}`}
                      onClick={() => openMessage(message)}
                      className="flex min-w-0 flex-1 gap-3 py-2.5 pr-4 text-left"
                    >
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarTone(label)}`}>
                        {initialsOf(label)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${message.read ? '' : 'font-semibold'}`}>
                            {!message.read && <span className="sr-only">Unread. </span>}
                            {label}
                          </span>
                          <span className={`shrink-0 text-[11px] ${message.read ? 'text-[#616161]' : 'font-semibold text-[#0f6cbd]'}`}>{formatMailTime(message.at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span className={`min-w-0 flex-1 truncate text-sm ${message.read ? '' : 'font-semibold text-[#0f6cbd]'}`}>{message.subject || '(no subject)'}</span>
                          {message.flagged && <Flag className="h-3.5 w-3.5 shrink-0 fill-[#c50f1f] text-[#c50f1f]" aria-label="Flagged" />}
                          {(message.hasAttachments || (message.attachments && message.attachments.length > 0)) && (
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#616161]" aria-label="Has attachments" />
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {(bothConnected || searchResult) && <ProviderBadge provider={provider} />}
                          {searchResult && <span className="shrink-0 text-[10px] text-[#616161]">{MAIL_FOLDERS.find((item) => item.id === message.folder)?.label}</span>}
                          <span className="block min-w-0 truncate text-xs text-[#616161]">{message.pending ? 'Sending…' : message.preview}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {!searchResult && !query.trim() && listFilter === 'all' && anyConnected && visible.length > 0 && !noOlder[folder] && (
                <li>
                  <button type="button" data-testid="email-load-older" onClick={loadOlder} disabled={loadingOlder} className="w-full py-3 text-sm font-semibold text-[#0f6cbd] hover:bg-[#f5f5f5] disabled:opacity-60">
                    {loadingOlder ? 'Loading older emails…' : 'Load older emails'}
                  </button>
                </li>
              )}
              {visible.length === 0 && (
                <li className="flex flex-col items-center px-4 py-12 text-center text-sm text-[#616161]">
                  <Inbox className="mb-2 h-8 w-8 text-[#c0c0c0]" />
                  {firstSync
                    ? 'Loading your mailbox…'
                    : searchResult
                      ? 'No messages match on the server.'
                      : query.trim()
                        ? 'No loaded messages match. Press Enter to search the whole mailbox.'
                        : listFilter === 'unread'
                          ? 'No unread mail.'
                          : listFilter === 'flagged'
                            ? 'No flagged or starred mail.'
                            : anyConnected
                              ? 'Nothing in this folder.'
                              : 'Connect a mailbox to see mail here.'}
                  {anyConnected && !firstSync && !searchResult && !query.trim() && folder === 'inbox' && listFilter === 'all' && (
                    <button type="button" onClick={() => setDialog('check')} className="mt-2 text-xs font-semibold text-[#0f6cbd] hover:underline">
                      Expected mail here? Run a mailbox check
                    </button>
                  )}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Reading pane */}
        {showReader && (
          <section aria-label="Reading pane" className="custom-scroll min-h-0 overflow-y-auto bg-white lg:m-2 lg:rounded-lg lg:border lg:border-[#e0e0e0]">
            {narrow && (
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className="m-3 inline-flex h-8 items-center gap-1 rounded-md border border-[#e0e0e0] px-2 text-sm lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {composing ? (
              <div className="space-y-2 p-4 sm:p-5" data-testid="email-compose-form">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {composing.mode === 'reply' || composing.mode === 'replyAll' ? 'Reply' : composing.mode === 'forward' ? 'Forward' : composing.mode === 'draft' ? 'Edit draft' : 'New message'}
                  </p>
                  <button type="button" aria-label="Discard" onClick={discardCompose} className="rounded p-1 text-[#616161] hover:bg-[#f0f0f0]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {composeNote && <p className="rounded-md bg-[#ebf3fc] px-3 py-1.5 text-xs text-[#0f548c]">{composeNote}</p>}
                <label className="flex items-center gap-2 text-xs text-[#616161]">
                  From
                  {bothConnected && !(composing.replyToId && !isLocalMailId(composing.replyToId) && composing.mode !== 'draft') ? (
                    <select
                      data-testid="email-from"
                      value={composing.via ?? 'outlook'}
                      onChange={(event) => setComposing({ ...composing, via: event.target.value as MailProvider })}
                      className="h-7 rounded border border-[#e0e0e0] px-1 text-xs text-[#242424]"
                    >
                      <option value="outlook">{outlookAddress || 'Outlook'} (Outlook)</option>
                      <option value="gmail">{gmailAddr || 'Gmail'} (Gmail)</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-[#242424]" data-testid="email-from-fixed">
                      {composing.via === 'gmail' ? gmailAddr || 'Gmail' : outlookAddress || account} ({PROVIDER_NAME[composing.via ?? 'outlook']})
                    </span>
                  )}
                </label>
                <input data-testid="email-to" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="To" aria-label="To" value={composing.to} onChange={(event) => setComposing({ ...composing, to: event.target.value })} />
                <input data-testid="email-cc" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Cc" aria-label="Cc" value={composing.cc} onChange={(event) => setComposing({ ...composing, cc: event.target.value })} />
                <input data-testid="email-bcc" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Bcc" aria-label="Bcc" value={composing.bcc} onChange={(event) => setComposing({ ...composing, bcc: event.target.value })} />
                <input data-testid="email-subject" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Add a subject" aria-label="Subject" value={composing.subject} onChange={(event) => setComposing({ ...composing, subject: event.target.value })} />
                <textarea data-testid="email-body" className="min-h-64 w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Write your message" aria-label="Message" value={composing.body} onChange={(event) => setComposing({ ...composing, body: event.target.value })} />
                {composing.attachments && composing.attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Attachments">
                    {composing.attachments.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] px-2 py-1 text-xs">
                        <Paperclip className="h-3.5 w-3.5 text-[#616161]" />
                        {file.name} <span className="text-[#616161]">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setComposing({ ...composing, attachments: composing.attachments?.filter((_, i) => i !== index) })}
                          className="rounded p-0.5 hover:bg-[#f0f0f0]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input ref={fileInput} type="file" multiple className="hidden" onChange={addFiles} data-testid="email-attach-input" />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" data-testid="email-send" onClick={sendCurrent} disabled={Boolean(pendingSend)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:opacity-60">
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                  <button type="button" data-testid="email-attach" onClick={() => fileInput.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]">
                    <Paperclip className="h-4 w-4" />
                    Attach
                  </button>
                  <button type="button" data-testid="email-save-draft" onClick={saveDraft} className="h-8 rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]">
                    Save draft
                  </button>
                  <button type="button" onClick={discardCompose} className="h-8 rounded-md px-3 text-sm text-[#616161] hover:bg-[#f5f5f5]">
                    Discard
                  </button>
                  <span className="text-[11px] text-[#616161]">Saved on this device while you type. Sending waits 10 seconds so you can undo.</span>
                </div>
              </div>
            ) : selected ? (
              <article className="p-4 sm:p-6" aria-label={selected.subject}>
                <div className="flex flex-wrap items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-xl font-semibold">{selected.subject || '(no subject)'}</h2>
                  <ProviderBadge provider={mailProvider(selected)} />
                  {selected.flagged && <Flag className="h-4 w-4 fill-[#c50f1f] text-[#c50f1f]" aria-label="Flagged" />}
                </div>
                {meetingSuggestion?.found && (
                  <div data-testid="email-meeting-found" className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[#c7dcf0] bg-[#ebf3fc] px-3 py-2 text-sm text-[#0f548c]">
                    <CalendarPlus className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {meetingSuggestion.meetingLike ? 'Meeting' : 'Date'} found: {meetingLabel(meetingSuggestion.date, meetingSuggestion.time)}
                    </span>
                    <button type="button" onClick={() => setCalendarDraft(meetingSuggestion)} className="h-7 rounded-md bg-[#0f6cbd] px-3 text-xs font-semibold text-white hover:bg-[#115ea3]">
                      Add to calendar
                    </button>
                  </div>
                )}
                {selected.folder === 'junk' && (
                  <p className="mt-3 rounded-md bg-[#fff8e6] px-3 py-2 text-xs text-[#7a5b00]">
                    This message is in Junk. Links and images stay blocked. If it is safe, choose Not junk to move it to the Inbox.
                  </p>
                )}
                <div className="mt-4 flex items-start gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarTone(selected.from || account)}`}>
                    {initialsOf(selected.from || account)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{selected.from || account}</p>
                      <p className="text-xs text-[#616161]">{new Date(selected.at).toLocaleString()}</p>
                    </div>
                    {selected.to && <p className="truncate text-xs text-[#616161]">To: {selected.to}</p>}
                    {selected.cc && <p className="truncate text-xs text-[#616161]">Cc: {selected.cc}</p>}
                    {selected.pending && <p className="mt-1 text-[11px] font-semibold text-[#7a5b00] uppercase">Sending — waiting for the provider to list it in Sent</p>}
                  </div>
                </div>
                {selected.folder === 'drafts' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]"
                      onClick={() => startCompose({ mode: 'draft', to: selected.to, cc: selected.cc ?? '', bcc: selected.bcc ?? '', subject: selected.subject, body: selected.body, replyToId: selected.id, via: mailProvider(selected) })}
                    >
                      Edit draft
                    </button>
                    <button
                      type="button"
                      data-testid="email-send-draft"
                      className="inline-flex h-8 items-center rounded-md bg-[#0f6cbd] px-3 text-sm font-semibold text-white"
                      onClick={() => dispatch({ mode: 'draft', to: selected.to, cc: selected.cc ?? '', bcc: selected.bcc ?? '', subject: selected.subject, body: selected.body, replyToId: selected.id, via: mailProvider(selected) })}
                    >
                      Send draft
                    </button>
                  </div>
                )}
                {selected.attachments && selected.attachments.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Attachments">
                    {selected.attachments.map((file) => (
                      <li key={file.id}>
                        <button type="button" onClick={() => downloadFile(selected, file)} className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 py-1.5 text-sm hover:bg-[#f5f5f5]">
                          <Paperclip className="h-3.5 w-3.5 text-[#616161]" />
                          {file.name}
                          <span className="text-xs text-[#616161]">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <MailBody key={selected.id} message={selected} error={bodyErrors[selected.id]} onRetry={() => setBodyRetry((n) => n + 1)} />
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm hover:bg-[#f5f5f5]" onClick={() => reply(selected, false)}>
                    <Reply className="h-4 w-4" /> Reply
                  </button>
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm hover:bg-[#f5f5f5]" onClick={() => reply(selected, true)}>
                    <ReplyAll className="h-4 w-4" /> Reply all
                  </button>
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm hover:bg-[#f5f5f5]" onClick={() => forward(selected)}>
                    <Forward className="h-4 w-4" /> Forward
                  </button>
                </div>
              </article>
            ) : (
              <div className="flex h-full min-h-60 flex-col items-center justify-center p-6 text-center text-[#616161]">
                <MailOpen className="mb-3 h-10 w-10 text-[#c0c0c0]" />
                <p className="text-sm font-semibold text-[#242424]">Select an item to read</p>
                <p className="mt-1 text-xs">
                  Press <kbd className="rounded border border-[#e0e0e0] px-1">?</kbd> for keyboard shortcuts
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Undo send */}
      {pendingSend && (
        <div role="status" data-testid="email-undo-send" className="fixed bottom-10 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-[#242424] px-4 py-2.5 text-sm text-white shadow-lg">
          Sending in {secondsLeft} s…
          <button type="button" onClick={undoSend} className="font-semibold text-[#9fd4ff] hover:underline" data-testid="email-undo">
            Undo
          </button>
          <button type="button" onClick={sendNowFromToast} className="text-white/80 hover:underline">
            Send now
          </button>
        </div>
      )}

      {/* Status bar */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#e0e0e0] bg-white px-3 py-1 text-[11px] text-[#616161]">
        <span data-testid="email-status" className="min-w-0 truncate" role="status" aria-live="polite">
          {status}
        </span>
        <span className="flex items-center gap-3">
          {alerts === 'default' && (
            <button type="button" data-testid="email-alerts" onClick={turnOnAlerts} className="font-semibold text-[#0f6cbd] hover:underline">
              Turn on desktop alerts
            </button>
          )}
          {syncedAt && <span>Last checked {new Date(syncedAt).toLocaleTimeString()}</span>}
          <button type="button" onClick={() => setDialog('capabilities')} className="inline-flex items-center gap-1 hover:underline">
            <Info className="h-3 w-3" /> Limits
          </button>
        </span>
      </footer>

      {dialog === 'check' && (
        <MailboxCheckDialog
          email={email}
          onClose={() => setDialog(null)}
          onResync={() => {
            setDialog(null)
            syncNow()
          }}
        />
      )}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === 'capabilities' && <CapabilitiesDialog onClose={() => setDialog(null)} />}
      {dialog === 'signature' && (
        <SignatureDialog
          value={signature}
          onClose={() => setDialog(null)}
          onSave={(next) => {
            saveSignature(account, next)
            setSignature(next)
            setDialog(null)
            setStatus(next.trim() ? 'Signature saved. It is added once to new messages, replies, and forwards.' : 'Signature removed.')
          }}
        />
      )}
      {calendarDraft && (
        <AddToCalendarDialog
          draft={calendarDraft}
          outlookConnected={outlookOn}
          onClose={() => setCalendarDraft(null)}
          onSaved={(message) => {
            setCalendarDraft(null)
            setStatus(message)
          }}
        />
      )}
    </div>
  )
}

function SignatureDialog({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (value: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" data-testid="email-signature-dialog">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Signature" className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold">Signature</h2>
        <p className="mt-1 text-xs text-[#616161]">Added once at the end of new messages, replies, and forwards. Kept in this app only; it does not change your Outlook or Gmail signature.</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} aria-label="Signature text" className="mt-3 h-32 w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0f6cbd]" />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-sm text-[#616161] hover:bg-[#f5f5f5]">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(text)} className="h-9 rounded-md bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3]">
            Save signature
          </button>
        </div>
      </div>
    </div>
  )
}
