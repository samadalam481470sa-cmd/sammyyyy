import { useEffect, useMemo, useState } from 'react'
import { PenSquare, RefreshCw } from 'lucide-react'
import { getGraphAccessToken } from '@/auth/msal'
import {
  OUTLOOK_SYNC_EVENT,
  lastOutlookSync,
  loadMailbox,
  markOutlookSynced,
  saveMailbox,
  type MailMessage,
} from '@/lib/outlookMailbox'

const FOLDERS = [
  ['inbox', 'Inbox'],
  ['sent', 'Sent'],
  ['drafts', 'Drafts'],
] as const

export function EmailPage() {
  const [folder, setFolder] = useState<(typeof FOLDERS)[number][0]>('inbox')
  const [messages, setMessages] = useState<MailMessage[]>(() => loadMailbox())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' })
  const [status, setStatus] = useState('Demo mailbox. These messages were not sent or received in Outlook.')
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(() => lastOutlookSync())

  const visible = useMemo(
    () => messages.filter((message) => message.folder === folder),
    [messages, folder],
  )
  const selected = messages.find((message) => message.id === selectedId) ?? null

  const sync = async () => {
    setSyncing(true)
    setStatus('Checking Microsoft Graph for mailbox access…')
    try {
      const token = await getGraphAccessToken(['User.Read', 'Mail.Read'])
      if (!token) {
        setStatus('Outlook is not connected. Showing the fictional demo mailbox. No mail was sent or received.')
        setSyncedAt(markOutlookSynced())
        return
      }
      const res = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=15&$select=id,subject,from,bodyPreview,receivedDateTime,isRead', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setStatus('Microsoft did not grant mailbox access. Showing the fictional demo mailbox.')
        setSyncedAt(markOutlookSynced())
        return
      }
      const json = (await res.json()) as {
        value?: Array<{
          id: string
          subject?: string
          bodyPreview?: string
          receivedDateTime?: string
          isRead?: boolean
          from?: { emailAddress?: { address?: string } }
        }>
      }
      const live: MailMessage[] = (json.value ?? []).map((row) => ({
        id: row.id,
        folder: 'inbox',
        from: row.from?.emailAddress?.address || 'unknown',
        to: '',
        subject: row.subject || '(no subject)',
        preview: row.bodyPreview || '',
        body: row.bodyPreview || '',
        at: row.receivedDateTime || new Date().toISOString(),
        read: Boolean(row.isRead),
        demo: true,
      }))
      if (live.length) {
        setMessages(live)
        saveMailbox(live)
        setStatus('Inbox loaded from Microsoft Graph. Sending is not enabled in this sprint.')
      } else {
        setStatus('Graph returned no inbox messages. Demo samples remain available if you clear this mailbox.')
      }
      setSyncedAt(markOutlookSynced())
    } catch {
      setStatus('Outlook sync failed. The fictional demo mailbox is still on screen. Nothing was sent.')
      setSyncedAt(markOutlookSynced())
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const onSync = () => {
      void sync()
    }
    window.addEventListener(OUTLOOK_SYNC_EVENT, onSync)
    return () => window.removeEventListener(OUTLOOK_SYNC_EVENT, onSync)
  }, [])

  const openMessage = (message: MailMessage) => {
    setComposing(false)
    setSelectedId(message.id)
    setMessages((prev) => {
      const next = prev.map((row) => (row.id === message.id ? { ...row, read: true } : row))
      saveMailbox(next)
      return next
    })
  }

  const sendDemo = () => {
    if (!draft.subject.trim() && !draft.body.trim()) return
    const message: MailMessage = {
      id: `demo-local-${Date.now()}`,
      folder: 'sent',
      from: 'you@newport.example',
      to: draft.to,
      subject: draft.subject || '(no subject)',
      preview: 'Demo only. This was not delivered.',
      body: `${draft.body}\n\nThis message stayed in the fictional demo mailbox.`,
      at: new Date().toISOString(),
      read: true,
      demo: true,
    }
    setMessages((prev) => {
      const next = [message, ...prev]
      saveMailbox(next)
      return next
    })
    setComposing(false)
    setDraft({ to: '', subject: '', body: '' })
    setFolder('sent')
    setSelectedId(message.id)
    setStatus('Saved in the demo Sent folder. Microsoft did not deliver this message.')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Email</h1>
          <p className="text-sm text-ink-muted">{status}</p>
          {syncedAt && <p className="text-[11px] text-ink-subtle">Last Outlook check {new Date(syncedAt).toLocaleString()}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-ink"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Outlook
          </button>
          <button
            type="button"
            onClick={() => {
              setComposing(true)
              setSelectedId(null)
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white"
          >
            <PenSquare className="h-4 w-4" />
            New Email
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[180px_280px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-canvas p-3 lg:border-r lg:border-b-0">
          {FOLDERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFolder(id)}
              className={`mb-1 flex h-10 w-full items-center rounded-lg px-3 text-sm font-semibold ${
                folder === id ? 'bg-navy-900 text-white' : 'text-ink hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </aside>
        <div className="custom-scroll border-b border-border lg:border-r lg:border-b-0">
          {visible.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => openMessage(message)}
              className={`block w-full border-b border-border px-3 py-3 text-left ${
                selectedId === message.id ? 'bg-accent-soft' : 'bg-surface'
              }`}
            >
              <p className={`truncate text-sm ${message.read ? 'text-ink-muted' : 'font-semibold text-navy-900'}`}>{message.from}</p>
              <p className="truncate text-sm text-ink">{message.subject}</p>
              <p className="truncate text-xs text-ink-subtle">{message.preview}</p>
            </button>
          ))}
          {visible.length === 0 && <p className="p-4 text-sm text-ink-muted">No demo messages in this folder.</p>}
        </div>
        <section className="bg-surface p-5">
          {composing ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-attention">Demo compose. This will not be sent through Outlook.</p>
              <input className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="To" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
              <input className="h-10 w-full rounded-lg border border-border px-3 text-sm" placeholder="Subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
              <textarea className="min-h-40 w-full rounded-lg border border-border px-3 py-2 text-sm" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
              <button type="button" onClick={sendDemo} disabled={!draft.subject.trim() && !draft.body.trim()} className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white disabled:border disabled:border-border disabled:bg-white disabled:text-ink-muted">
                Save demo reply
              </button>
            </div>
          ) : selected ? (
            <article>
              <p className="text-xs font-semibold tracking-wide text-attention uppercase">Demo message</p>
              <h2 className="mt-1 font-brand text-2xl font-bold text-navy-900">{selected.subject}</h2>
              <p className="mt-2 text-sm text-ink-muted">From {selected.from}</p>
              {selected.to && <p className="text-sm text-ink-muted">To {selected.to}</p>}
              <p className="text-xs text-ink-subtle">{new Date(selected.at).toLocaleString()}</p>
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-ink">{selected.body}</p>
              <button
                type="button"
                className="mt-4 h-10 rounded-lg border border-border px-3 text-sm font-semibold"
                onClick={() => {
                  setComposing(true)
                  setDraft({ to: selected.from, subject: `Re: ${selected.subject}`, body: '' })
                }}
              >
                Reply in demo mailbox
              </button>
            </article>
          ) : (
            <p className="text-sm text-ink-muted">Select a demo message. Email is not linked to deals.</p>
          )}
        </section>
      </div>
    </div>
  )
}
