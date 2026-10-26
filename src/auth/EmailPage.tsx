import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  Archive,
  ArrowLeft,
  FileText,
  Forward,
  Inbox,
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
  Trash,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { normalizeEmail } from '@/lib/emailIdentity'
import { parseAddresses, uniqueAddresses } from '@/lib/mailAddress'
import { renderMailHtml } from '@/lib/mailHtml'
import {
  MAIL_FOLDERS,
  filterMailbox,
  formatMailTime,
  isLocalMailId,
  isTypingTarget,
  lastOutlookSync,
  loadMailbox,
  makePendingSent,
  mergeMailbox,
  relocateMessage,
  saveMailbox,
  type MailAttachment,
  type MailFolder,
  type MailMessage,
} from '@/lib/outlookMailbox'
import {
  downloadOutlookAttachment,
  getOutlookMessage,
  listOutlookAttachments,
  outlookToken,
} from '@/lib/outlookGraph'
import {
  OUTLOOK_SYNCED_EVENT,
  OUTLOOK_VISIBLE_SYNC_MS,
  deliverMail,
  pushMailMove,
  pushMailRead,
  readSyncDetail,
  saveDraftMail,
  sendDraftMail,
  setOutlookMailSurfaceActive,
  syncOutlookNow,
} from '@/lib/outlookSync'

type ListFilter = 'all' | 'unread'
type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft'

interface ComposeDraft {
  mode: ComposeMode
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  replyToId?: string
}

function subjectWith(prefix: 'Re' | 'Fwd', subject: string): string {
  const trimmed = subject.trim()
  if (new RegExp(`^${prefix}:`, 'i').test(trimmed)) return trimmed
  return `${prefix}: ${trimmed}`
}

function replyFields(message: MailMessage, account: string, all: boolean): { to: string; cc: string } {
  if (!all) return { to: message.from, cc: '' }
  const self = normalizeEmail(account)
  const tos = uniqueAddresses(
    [message.from, ...parseAddresses(message.to)].filter((address) => normalizeEmail(address) !== self),
  )
  const cc = uniqueAddresses(
    parseAddresses(message.cc).filter(
      (address) => normalizeEmail(address) !== self && !tos.some((item) => item.toLowerCase() === address.toLowerCase()),
    ),
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
  if (message.folder === 'sent' || message.folder === 'drafts') {
    return message.to ? `To ${message.to}` : 'No recipient'
  }
  return message.from || 'Unknown sender'
}

export function EmailPage() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const account = normalizeEmail(email)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [messages, setMessages] = useState<MailMessage[]>(() => loadMailbox(email))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState<ComposeDraft | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Checking Microsoft Graph…')
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(() => lastOutlookSync(email))
  const [graphMode, setGraphMode] = useState<'graph' | 'demo'>(() =>
    loadMailbox(email).some((message) => !message.demo) ? 'graph' : 'demo',
  )
  const [mobilePane, setMobilePane] = useState<'list' | 'read'>('list')
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )

  const visible = useMemo(() => {
    const rows = filterMailbox(messages, folder, query)
    return listFilter === 'unread' ? rows.filter((message) => !message.read) : rows
  }, [messages, folder, query, listFilter])
  const selected = messages.find((message) => message.id === selectedId) ?? null
  const folderLabel = MAIL_FOLDERS.find((item) => item.id === folder)?.label ?? 'Inbox'
  const showList = !narrow || (mobilePane === 'list' && !composing)
  const showReader = !narrow || mobilePane === 'read' || Boolean(composing)

  const refreshFromStore = () => {
    const next = loadMailbox(email)
    setMessages(next)
    setSelectedId((current) => (current && next.some((message) => message.id === current) ? current : null))
    setSyncedAt(lastOutlookSync(email))
    return next
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const apply = () => setNarrow(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = readSyncDetail((event as CustomEvent<unknown>).detail)
      refreshFromStore()
      setStatus(detail.message)
      setGraphMode(detail.mode)
      setSyncing(false)
    }
    window.addEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(OUTLOOK_SYNCED_EVENT, onSynced)
  }, [email])

  useEffect(() => {
    setMessages(loadMailbox(email))
    setSyncedAt(lastOutlookSync(email))
    setSelectedId(null)
    setComposing(null)
    setFolder('inbox')
    setMobilePane('list')
    setQuery('')
    if (!email) return
    setSyncing(true)
    setStatus(`Checking Microsoft Graph for ${account}…`)
    void syncOutlookNow(email, { incremental: false, mail: true })
  }, [email, account])

  useEffect(() => {
    const syncSurface = () => setOutlookMailSurfaceActive(document.visibilityState !== 'hidden')
    syncSurface()
    const onVisible = () => syncSurface()
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void syncOutlookNow(email, { incremental: true, mail: true })
    }, OUTLOOK_VISIBLE_SYNC_MS)
    return () => {
      setOutlookMailSurfaceActive(false)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [email])

  useEffect(() => {
    const message = loadMailbox(email).find((row) => row.id === selectedId)
    if (!message || message.demo || message.pending || message.bodyLoaded) return
    let cancel = false
    void (async () => {
      const token = await outlookToken(false)
      if (!token || cancel) return
      const full = await getOutlookMessage(token, message.id, message.folder)
      if (!full || cancel) return
      const attachments = full.hasAttachments ? await listOutlookAttachments(token, message.id) : []
      if (cancel) return
      setMessages((prev) => {
        const next = prev.map((row) =>
          row.id === full.id ? { ...row, ...full, folder: row.folder, attachments, bodyLoaded: true } : row,
        )
        saveMailbox(email, next)
        return next
      })
    })()
    return () => {
      cancel = true
    }
  }, [selectedId, email])

  const openMessage = (message: MailMessage) => {
    setComposing(null)
    setSelectedId(message.id)
    setMobilePane('read')
    if (message.read) return
    setMessages((prev) => {
      const next = prev.map((row) => (row.id === message.id ? { ...row, read: true } : row))
      saveMailbox(email, next)
      return next
    })
    void pushMailRead(message.id, true).catch(() => {
      setStatus('Marked read here. Outlook has not confirmed it yet.')
    })
  }

  const connectOutlook = () => {
    setSyncing(true)
    setStatus('Connecting Outlook…')
    void outlookToken(true).then((token) => {
      if (!token) {
        setSyncing(false)
        setGraphMode('demo')
        setStatus(`Fictional mailbox for ${account}. Outlook consent was not granted.`)
        return
      }
      void syncOutlookNow(email, { incremental: false, mail: true })
    })
  }

  const syncNow = () => {
    setSyncing(true)
    setStatus('Checking Microsoft Graph…')
    void syncOutlookNow(email, { incremental: false, mail: true })
  }

  const startCompose = (draft: ComposeDraft) => {
    setComposing(draft)
    setMobilePane('read')
  }

  const finishSend = (mode: 'graph' | 'demo') => {
    refreshFromStore()
    setGraphMode(mode)
    setFolder('sent')
    setStatus(
      mode === 'graph'
        ? `Sent from ${account} through Microsoft Graph.`
        : `Saved in the fictional Sent folder for ${account}. Microsoft did not deliver this message.`,
    )
    if (mode === 'graph') void syncOutlookNow(email, { incremental: true, mail: true })
  }

  const sendStoredDraft = (message: MailMessage) => {
    setComposing(null)
    setFolder('sent')
    setMobilePane('read')
    void sendDraftMail(email, message).then(finishSend)
  }

  const sendCurrent = () => {
    if (!composing) return
    const draft = composing
    const needsRecipient = draft.mode === 'new' || draft.mode === 'forward' || draft.mode === 'draft'
    if (needsRecipient && !draft.to.includes('@')) {
      setStatus('Enter at least one recipient.')
      return
    }
    if ((draft.mode === 'reply' || draft.mode === 'replyAll') && !draft.body.trim()) {
      setStatus('Write a reply before sending.')
      return
    }
    if (draft.mode === 'draft' && draft.replyToId) {
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
      sendStoredDraft(message)
      return
    }

    const pending = makePendingSent({
      from: account,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
    })
    setComposing(null)
    setFolder('sent')
    setMobilePane('read')
    setSelectedId(pending.id)
    setMessages((prev) => {
      const next = mergeMailbox(prev, { incoming: [pending] })
      saveMailbox(email, next)
      return next
    })
    void deliverMail({
      email,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      replyToId: draft.mode === 'new' ? undefined : draft.replyToId,
      action: draft.mode === 'reply' || draft.mode === 'replyAll' || draft.mode === 'forward' ? draft.mode : 'send',
      skipGraph: draft.replyToId ? isLocalMailId(draft.replyToId) : false,
    }).then((mode) => {
      if (mode === 'demo') {
        const stored = loadMailbox(email).filter((message) => message.id !== pending.id)
        saveMailbox(email, stored)
        setMessages(stored)
        const sent = stored.find((message) => message.demo && message.folder === 'sent' && message.subject === pending.subject)
        setSelectedId(sent?.id ?? null)
        setGraphMode('demo')
        setStatus(`Saved in the fictional Sent folder for ${account}. Microsoft did not deliver this message.`)
        return
      }
      setStatus(`Sent from ${account} through Microsoft Graph.`)
      void syncOutlookNow(email, { incremental: true, mail: true })
    }).catch((err) => {
      const stored = loadMailbox(email).filter((message) => message.id !== pending.id)
      saveMailbox(email, stored)
      setMessages(stored)
      setStatus(err instanceof Error ? err.message : 'Outlook send failed. Nothing was delivered.')
    })
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
    }).then((saved) => {
      refreshFromStore()
      setFolder('drafts')
      setSelectedId(saved.id)
      setComposing(null)
      setMobilePane('read')
      setStatus(saved.demo ? `Draft kept for ${account}.` : `Draft saved in Outlook for ${account}.`)
    })
  }

  const moveMessage = (message: MailMessage, target: 'deleted' | 'archive') => {
    const snapshot = loadMailbox(email)
    const next = relocateMessage(snapshot, message.id, target)
    setMessages(next)
    saveMailbox(email, next)
    if (selectedId === message.id) {
      setSelectedId(null)
      setMobilePane('list')
    }
    void pushMailMove(message.id, target).catch(() => {
      setMessages(snapshot)
      saveMailbox(email, snapshot)
      setSelectedId(message.id)
      setStatus('Outlook did not move that message.')
    })
  }

  const toggleRead = (message: MailMessage) => {
    const read = !message.read
    setMessages((prev) => {
      const next = prev.map((row) => (row.id === message.id ? { ...row, read } : row))
      saveMailbox(email, next)
      return next
    })
    void pushMailRead(message.id, read).catch(() => {
      setStatus('Outlook did not update the read state.')
    })
  }

  const downloadFile = (message: MailMessage, file: MailAttachment) => {
    void (async () => {
      const token = await outlookToken(false)
      if (!token) {
        setStatus(`Connect Outlook to download ${file.name}.`)
        return
      }
      try {
        await downloadOutlookAttachment(token, message.id, file)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Outlook did not download that file.')
      }
    })()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && composing) {
      event.preventDefault()
      setComposing(null)
      return
    }
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.closest('[data-mail-list]')) return
    if (isTypingTarget(target)) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!visible.length) return
      const index = Math.max(0, visible.findIndex((message) => message.id === selectedId))
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(visible.length - 1, index + 1)
        : Math.max(0, index - 1)
      const row = visible[nextIndex]
      if (row) openMessage(row)
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return
    const current = visible.find((message) => message.id === selectedId) ?? visible[0]
    if (!current) return
    event.preventDefault()
    openMessage(current)
  }

  const html = selected ? renderMailHtml(selected) : ''
  const ribbonButton =
    'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-[#242424] hover:bg-[#f0f0f0] disabled:text-[#a0a0a0] disabled:hover:bg-transparent'

  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f5f5] text-[#242424]"
      onKeyDown={onKeyDown}
      data-testid="outlook-home"
    >
      {/* Outlook-style app bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 bg-[#0f6cbd] px-3 text-white sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <Mail className="h-5 w-5" />
          <h1 className="text-base font-semibold">Outlook</h1>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#0f6cbd]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mail"
            data-testid="email-search"
            aria-label="Search mail"
            className="h-8 w-full rounded-md bg-[#ebf3fc] pr-3 pl-9 text-sm text-[#242424] outline-none placeholder:text-[#616161] focus:bg-white"
          />
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          aria-label="Sync mail"
          title="Sync mail"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/15"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
        <span
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold sm:inline-flex"
          title={account}
        >
          {initialsOf(account || 'Me')}
        </span>
      </header>

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
        <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && moveMessage(selected, 'deleted')}>
          <Trash className="h-4 w-4" /> Delete
        </button>
        <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && moveMessage(selected, 'archive')}>
          <Archive className="h-4 w-4" /> Archive
        </button>
        <button type="button" className={ribbonButton} disabled={!selected} onClick={() => selected && toggleRead(selected)}>
          {selected && !selected.read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          {selected && !selected.read ? 'Mark read' : 'Mark unread'}
        </button>
        <span className="mx-1 hidden h-5 w-px bg-[#e0e0e0] sm:inline-block" />
        <button
          type="button"
          className={ribbonButton}
          disabled={!selected}
          onClick={() => selected && startCompose({ mode: 'reply', ...replyFields(selected, account, false), bcc: '', subject: subjectWith('Re', selected.subject), body: '', replyToId: selected.id })}
        >
          <Reply className="h-4 w-4" /> Reply
        </button>
        <button
          type="button"
          className={ribbonButton}
          disabled={!selected}
          onClick={() => selected && startCompose({ mode: 'replyAll', ...replyFields(selected, account, true), bcc: '', subject: subjectWith('Re', selected.subject), body: '', replyToId: selected.id })}
        >
          <ReplyAll className="h-4 w-4" /> Reply all
        </button>
        <button
          type="button"
          className={ribbonButton}
          disabled={!selected}
          onClick={() => selected && startCompose({ mode: 'forward', to: '', cc: '', bcc: '', subject: subjectWith('Fwd', selected.subject), body: quoted(selected), replyToId: selected.id })}
        >
          <Forward className="h-4 w-4" /> Forward
        </button>
        {graphMode === 'demo' && (
          <button
            type="button"
            data-testid="email-connect"
            onClick={connectOutlook}
            className="ml-auto inline-flex h-8 items-center rounded-md border border-[#0f6cbd] px-3 text-sm font-semibold text-[#0f6cbd] hover:bg-[#ebf3fc]"
          >
            Connect Outlook
          </button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(280px,360px)_minmax(0,1fr)]">
        {/* Folder pane */}
        {showList && (
          <nav className="flex min-h-0 gap-1 overflow-x-auto border-b border-[#e0e0e0] bg-[#f5f5f5] p-2 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2 lg:py-3">
            <p className="hidden truncate px-3 pb-2 text-xs font-semibold text-[#616161] lg:block" title={account}>
              {account || 'Mailbox'}
            </p>
            {MAIL_FOLDERS.map((item) => {
              const count = messages.filter((message) => message.folder === item.id && !message.read).length
              const Icon = FOLDER_ICONS[item.id]
              const active = folder === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`email-folder-${item.id}`}
                  onClick={() => {
                    setFolder(item.id)
                    setMobilePane('list')
                    setComposing(null)
                  }}
                  className={`relative flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm lg:w-full ${
                    active ? 'bg-[#e6eef8] font-semibold text-[#0f6cbd]' : 'text-[#242424] hover:bg-[#ebebeb]'
                  }`}
                >
                  {active && <span className="absolute top-2 bottom-2 left-0 hidden w-0.5 rounded bg-[#0f6cbd] lg:block" />}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count > 0 && <span className="text-xs font-semibold text-[#0f6cbd]">{count}</span>}
                </button>
              )
            })}
          </nav>
        )}

        {/* Message list */}
        {showList && (
          <div className="flex min-h-0 flex-col border-b border-[#e0e0e0] bg-white lg:border-r lg:border-b-0" data-mail-list>
            <div className="flex items-center justify-between gap-2 border-b border-[#e0e0e0] px-4 pt-3 pb-2">
              <h2 className="text-base font-semibold">{folderLabel}</h2>
              <div className="flex rounded-md bg-[#f5f5f5] p-0.5 text-xs">
                {(['all', 'unread'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`email-filter-${value}`}
                    onClick={() => setListFilter(value)}
                    className={`h-6 rounded px-2.5 font-semibold capitalize ${listFilter === value ? 'bg-white text-[#0f6cbd] shadow-sm' : 'text-[#616161]'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            {graphMode === 'demo' && (
              <p className="border-b border-[#e0e0e0] bg-[#fff8e6] px-4 py-2 text-xs text-[#7a5b00]">
                Sample mail for {account}. Click Connect Outlook to load your real inbox here.
              </p>
            )}
            <div className="custom-scroll min-h-0 flex-1 overflow-y-auto">
              {visible.map((message) => {
                const label = senderLabel(message)
                const active = selectedId === message.id
                return (
                  <button
                    key={message.id}
                    type="button"
                    data-testid={`email-row-${message.id}`}
                    onClick={() => openMessage(message)}
                    className={`relative flex w-full gap-3 border-b border-[#f0f0f0] px-4 py-2.5 text-left ${
                      active ? 'bg-[#e6eef8]' : 'hover:bg-[#f5f5f5]'
                    }`}
                  >
                    {!message.read && <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-[#0f6cbd]" />}
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarTone(label)}`}>
                      {initialsOf(label)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${message.read ? '' : 'font-semibold'}`}>{label}</span>
                        <span className={`shrink-0 text-[11px] ${message.read ? 'text-[#616161]' : 'font-semibold text-[#0f6cbd]'}`}>
                          {formatMailTime(message.at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1">
                        <span className={`min-w-0 flex-1 truncate text-sm ${message.read ? '' : 'font-semibold text-[#0f6cbd]'}`}>
                          {message.subject}
                        </span>
                        {(message.hasAttachments || (message.attachments && message.attachments.length > 0)) && (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#616161]" aria-label="Has attachments" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-[#616161]">{message.pending ? 'Sending…' : message.preview}</span>
                    </span>
                  </button>
                )
              })}
              {visible.length === 0 && (
                <div className="flex flex-col items-center px-4 py-12 text-center text-sm text-[#616161]">
                  <Inbox className="mb-2 h-8 w-8 text-[#c0c0c0]" />
                  {query.trim() ? 'No messages match your search.' : listFilter === 'unread' ? 'No unread mail.' : 'Nothing in this folder.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reading pane */}
        {showReader && (
          <section className="custom-scroll min-h-0 overflow-y-auto bg-white lg:m-2 lg:rounded-lg lg:border lg:border-[#e0e0e0]">
            {narrow && (
              <button
                type="button"
                onClick={() => {
                  setMobilePane('list')
                  setComposing(null)
                }}
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
                    {composing.mode === 'reply' || composing.mode === 'replyAll' ? 'Reply' : composing.mode === 'forward' ? 'Forward' : 'New message'}
                  </p>
                  <button type="button" aria-label="Discard" onClick={() => setComposing(null)} className="rounded p-1 text-[#616161] hover:bg-[#f0f0f0]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-[#616161]">From {account}</p>
                <input data-testid="email-to" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="To" value={composing.to} onChange={(event) => setComposing({ ...composing, to: event.target.value })} />
                <input data-testid="email-cc" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Cc" value={composing.cc} onChange={(event) => setComposing({ ...composing, cc: event.target.value })} />
                <input data-testid="email-bcc" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Bcc" value={composing.bcc} onChange={(event) => setComposing({ ...composing, bcc: event.target.value })} />
                <input data-testid="email-subject" className="h-9 w-full border-b border-[#e0e0e0] px-1 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Add a subject" value={composing.subject} onChange={(event) => setComposing({ ...composing, subject: event.target.value })} />
                <textarea data-testid="email-body" className="min-h-64 w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0f6cbd]" placeholder="Write your message" value={composing.body} onChange={(event) => setComposing({ ...composing, body: event.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" data-testid="email-send" onClick={sendCurrent} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3]">
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                  <button type="button" data-testid="email-save-draft" onClick={saveDraft} className="h-8 rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]">
                    Save draft
                  </button>
                  <button type="button" onClick={() => setComposing(null)} className="h-8 rounded-md px-3 text-sm text-[#616161] hover:bg-[#f5f5f5]">
                    Discard
                  </button>
                </div>
              </div>
            ) : selected ? (
              <article className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold">{selected.subject}</h2>
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
                    {(selected.demo || selected.pending) && (
                      <p className="mt-1 text-[11px] font-semibold text-[#7a5b00] uppercase">{selected.demo ? 'Sample' : 'Sending'}</p>
                    )}
                  </div>
                </div>
                {selected.folder === 'drafts' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="inline-flex h-8 items-center rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]" onClick={() => startCompose({ mode: 'draft', to: selected.to, cc: selected.cc ?? '', bcc: selected.bcc ?? '', subject: selected.subject, body: selected.body, replyToId: selected.id })}>
                      Edit draft
                    </button>
                    <button type="button" data-testid="email-send-draft" className="inline-flex h-8 items-center rounded-md bg-[#0f6cbd] px-3 text-sm font-semibold text-white" onClick={() => sendStoredDraft(selected)}>
                      Send draft
                    </button>
                  </div>
                )}
                {selected.attachments && selected.attachments.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
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
                <div
                  className="mt-5 text-sm leading-relaxed [&_a]:text-[#0f6cbd] [&_blockquote]:border-l-2 [&_blockquote]:border-[#e0e0e0] [&_blockquote]:pl-3 [&_p]:mb-3"
                  data-testid="email-body-html"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm hover:bg-[#f5f5f5]" onClick={() => startCompose({ mode: 'reply', ...replyFields(selected, account, false), bcc: '', subject: subjectWith('Re', selected.subject), body: '', replyToId: selected.id })}>
                    <Reply className="h-4 w-4" /> Reply
                  </button>
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-sm hover:bg-[#f5f5f5]" onClick={() => startCompose({ mode: 'forward', to: '', cc: '', bcc: '', subject: subjectWith('Fwd', selected.subject), body: quoted(selected), replyToId: selected.id })}>
                    <Forward className="h-4 w-4" /> Forward
                  </button>
                </div>
              </article>
            ) : (
              <div className="flex h-full min-h-60 flex-col items-center justify-center p-6 text-center text-[#616161]">
                <MailOpen className="mb-3 h-10 w-10 text-[#c0c0c0]" />
                <p className="text-sm font-semibold text-[#242424]">Select an item to read</p>
                <p className="mt-1 text-xs">Nothing is selected</p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#e0e0e0] bg-white px-3 py-1 text-[11px] text-[#616161]">
        <span data-testid="email-status" className="truncate">{status}</span>
        {syncedAt && <span>Last checked {new Date(syncedAt).toLocaleString()}</span>}
      </footer>
    </div>
  )
}
