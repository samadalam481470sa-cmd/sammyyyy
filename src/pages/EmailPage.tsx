import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  Archive,
  ArrowLeft,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Trash,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { getMicrosoftAccount } from '@/auth/msal'
import { OutlookWindowPane } from '@/components/email/OutlookWindowPane'
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
import { openOutlookMailWindow } from '@/lib/outlookWindow'

type MailView = 'mailbox' | 'outlook'
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
  const [view, setView] = useState<MailView>('mailbox')
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
  const [outlookBlocked, setOutlookBlocked] = useState(false)

  const visible = useMemo(() => filterMailbox(messages, folder, query), [messages, folder, query])
  const selected = messages.find((message) => message.id === selectedId) ?? null
  const tenantId = getMicrosoftAccount()?.tenantId ?? null
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

  const openOutlook = () => {
    const result = openOutlookMailWindow(email, getMicrosoftAccount()?.tenantId)
    setOutlookBlocked(result === 'blocked')
    setView('outlook')
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

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas" onKeyDown={onKeyDown}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl font-bold text-navy-900">Email</h1>
          <p className="truncate text-sm font-semibold text-navy-900">{account || 'Sign in to open a mailbox'}</p>
          <p className="text-sm text-ink-muted" data-testid="email-status">{status}</p>
          {syncedAt && <p className="text-[11px] text-ink-subtle">Last check {new Date(syncedAt).toLocaleString()}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              data-testid="email-view-mailbox"
              onClick={() => setView('mailbox')}
              className={`h-9 rounded-md px-3 text-sm font-semibold ${view === 'mailbox' ? 'bg-navy-900 text-white' : 'text-ink'}`}
            >
              Mailbox
            </button>
            <button
              type="button"
              data-testid="email-view-outlook"
              onClick={openOutlook}
              className={`h-9 rounded-md px-3 text-sm font-semibold ${view === 'outlook' ? 'bg-navy-900 text-white' : 'text-ink'}`}
            >
              Outlook
            </button>
          </div>
          {graphMode === 'demo' && (
            <button
              type="button"
              data-testid="email-connect"
              onClick={() => {
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
              }}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold text-ink"
            >
              Connect Outlook
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSyncing(true)
              setStatus('Checking Microsoft Graph…')
              void syncOutlookNow(email, { incremental: false, mail: true })
            }}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-ink disabled:text-ink-subtle"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button
            type="button"
            data-testid="email-compose"
            onClick={() => startCompose({ mode: 'new', to: '', cc: '', bcc: '', subject: '', body: '' })}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white"
          >
            <PenSquare className="h-4 w-4" />
            New Email
          </button>
        </div>
      </header>

      {view === 'outlook' ? (
        <OutlookWindowPane email={account} tenantId={tenantId} blocked={outlookBlocked} onOpen={openOutlook} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[200px_minmax(260px,340px)_minmax(0,1fr)]">
          {showList && (
            <aside className="flex min-h-0 gap-1 overflow-x-auto border-b border-border bg-canvas p-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3">
              {MAIL_FOLDERS.map((item) => {
                const count = messages.filter((message) => message.folder === item.id && !message.read).length
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
                    className={`flex h-10 shrink-0 items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold lg:mb-1 lg:w-full ${
                      folder === item.id ? 'bg-navy-900 text-white' : 'text-ink hover:bg-surface'
                    }`}
                  >
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 text-[11px] ${folder === item.id ? 'bg-white/15' : 'bg-accent-soft text-navy-900'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </aside>
          )}

          {showList && (
            <div className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0" data-mail-list>
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${folder}`}
                    data-testid="email-search"
                    aria-label={`Search ${folder}`}
                    className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                {graphMode === 'demo' && (
                  <p className="px-1 pt-2 text-xs text-ink-muted">Fictional sample for {account}.</p>
                )}
              </div>
              <div className="custom-scroll min-h-0 flex-1 overflow-y-auto">
                {visible.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    data-testid={`email-row-${message.id}`}
                    onClick={() => openMessage(message)}
                    className={`flex w-full gap-2 border-b border-border px-3 py-3 text-left ${
                      selectedId === message.id ? 'bg-accent-soft' : 'bg-surface hover:bg-canvas'
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${message.read ? 'bg-transparent' : 'bg-accent'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${message.read ? 'text-ink-muted' : 'font-semibold text-navy-900'}`}>
                          {senderLabel(message)}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-subtle">{formatMailTime(message.at)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1">
                        <span className={`min-w-0 flex-1 truncate text-sm ${message.read ? 'text-ink' : 'font-semibold text-ink'}`}>
                          {message.subject}
                        </span>
                        {(message.hasAttachments || (message.attachments && message.attachments.length > 0)) && (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-label="Has attachments" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {message.pending ? 'Sending…' : message.preview}
                      </span>
                    </span>
                  </button>
                ))}
                {visible.length === 0 && (
                  <p className="p-4 text-sm text-ink-muted">{query.trim() ? 'No messages match.' : 'Nothing in this folder.'}</p>
                )}
              </div>
            </div>
          )}

          {showReader && (
            <section className="custom-scroll min-h-0 overflow-y-auto bg-surface p-4 sm:p-5">
              {narrow && (
                <button
                  type="button"
                  onClick={() => {
                    setMobilePane('list')
                    setComposing(null)
                  }}
                  className="mb-3 inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-sm font-semibold lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              {composing ? (
                <div className="space-y-2" data-testid="email-compose-form">
                  <p className="text-xs font-semibold text-ink-muted">From {account}</p>
                  <input data-testid="email-to" className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="To — any address, including gmail.com" value={composing.to} onChange={(event) => setComposing({ ...composing, to: event.target.value })} />
                  <input data-testid="email-cc" className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="Cc" value={composing.cc} onChange={(event) => setComposing({ ...composing, cc: event.target.value })} />
                  <input data-testid="email-bcc" className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="Bcc" value={composing.bcc} onChange={(event) => setComposing({ ...composing, bcc: event.target.value })} />
                  <input data-testid="email-subject" className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="Subject" value={composing.subject} onChange={(event) => setComposing({ ...composing, subject: event.target.value })} />
                  <textarea data-testid="email-body" className="min-h-40 w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="Write your message" value={composing.body} onChange={(event) => setComposing({ ...composing, body: event.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" data-testid="email-send" onClick={sendCurrent} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white">
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                    <button type="button" data-testid="email-save-draft" onClick={saveDraft} className="h-10 rounded-lg border border-border px-3 text-sm font-semibold">
                      Save draft
                    </button>
                  </div>
                </div>
              ) : selected ? (
                <article>
                  <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    {selected.demo ? 'Fictional' : selected.pending ? 'Sending' : 'Microsoft mailbox'}
                  </p>
                  <h2 className="mt-1 font-brand text-2xl font-bold text-navy-900">{selected.subject}</h2>
                  <p className="mt-2 text-sm text-ink-muted">From {selected.from || account}</p>
                  {selected.to && <p className="text-sm text-ink-muted">To {selected.to}</p>}
                  {selected.cc && <p className="text-sm text-ink-muted">Cc {selected.cc}</p>}
                  <p className="text-xs text-ink-subtle">{new Date(selected.at).toLocaleString()}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => startCompose({ mode: 'reply', ...replyFields(selected, account, false), bcc: '', subject: subjectWith('Re', selected.subject), body: '', replyToId: selected.id })}>
                      <Reply className="h-4 w-4" /> Reply
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => startCompose({ mode: 'replyAll', ...replyFields(selected, account, true), bcc: '', subject: subjectWith('Re', selected.subject), body: '', replyToId: selected.id })}>
                      <ReplyAll className="h-4 w-4" /> Reply all
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => startCompose({ mode: 'forward', to: '', cc: '', bcc: '', subject: subjectWith('Fwd', selected.subject), body: quoted(selected), replyToId: selected.id })}>
                      <Forward className="h-4 w-4" /> Forward
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => moveMessage(selected, 'archive')}>
                      <Archive className="h-4 w-4" /> Archive
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => moveMessage(selected, 'deleted')}>
                      <Trash className="h-4 w-4" /> Delete
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => toggleRead(selected)}>
                      {selected.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                      {selected.read ? 'Mark unread' : 'Mark read'}
                    </button>
                    {selected.folder === 'drafts' && (
                      <>
                        <button type="button" className="inline-flex h-9 items-center rounded-lg border border-border px-2.5 text-sm font-semibold" onClick={() => startCompose({ mode: 'draft', to: selected.to, cc: selected.cc ?? '', bcc: selected.bcc ?? '', subject: selected.subject, body: selected.body, replyToId: selected.id })}>
                          Edit draft
                        </button>
                        <button type="button" data-testid="email-send-draft" className="inline-flex h-9 items-center rounded-lg bg-navy-900 px-2.5 text-sm font-semibold text-white" onClick={() => sendStoredDraft(selected)}>
                          Send draft
                        </button>
                      </>
                    )}
                  </div>
                  {selected.attachments && selected.attachments.length > 0 && (
                    <ul className="mt-4 space-y-1">
                      {selected.attachments.map((file) => (
                        <li key={file.id}>
                          <button type="button" onClick={() => downloadFile(selected, file)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                            <Paperclip className="h-3.5 w-3.5" />
                            {file.name}
                            <span className="font-normal text-ink-subtle">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div
                    className="mt-4 text-sm leading-relaxed text-ink [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_p]:mb-3"
                    data-testid="email-body-html"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </article>
              ) : (
                <p className="text-sm text-ink-muted">Select a message.</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
