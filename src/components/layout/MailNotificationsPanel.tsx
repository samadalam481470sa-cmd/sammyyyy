import { useEffect, useState } from 'react'
import { AlertTriangle, Inbox, Mail, X } from 'lucide-react'
import type { TaskRecord } from '@/data/mockModules'
import { useNavigate } from 'react-router-dom'
import { formatMailTime, loadMailbox, mailProvider, saveMailbox, type MailMessage } from '@/lib/outlookMailbox'
import { graphTokenError, outlookToken } from '@/lib/outlookGraph'
import { OUTLOOK_SYNCED_EVENT, mailSyncHealth, pushMailRead, syncOutlookNow } from '@/lib/outlookSync'

export interface UnreadMailState {
  /** Unread incoming Inbox mail, newest first. */
  unread: MailMessage[]
  /** A mailbox (Outlook or Gmail) is connected for this user. */
  available: boolean
}

function readUnread(email: string): UnreadMailState {
  const mailbox = email ? loadMailbox(email) : []
  const unread = mailbox
    .filter((message) => message.folder === 'inbox' && !message.read && !message.demo && !message.pending)
    .sort((a, b) => b.at.localeCompare(a.at))
  const health = mailSyncHealth(email)
  const connected = Object.values(health).some((row) => row && row.state !== 'not_connected')
  const hasMail = mailbox.some((message) => !message.demo)
  return { unread, available: connected || hasMail }
}

/** Live unread incoming mail for the signed-in user, from the app's existing mail sync. */
export function useUnreadMail(email: string): UnreadMailState {
  const [state, setState] = useState<UnreadMailState>(() => readUnread(email))
  useEffect(() => {
    const update = () => setState(readUnread(email))
    update()
    window.addEventListener(OUTLOOK_SYNCED_EVENT, update)
    window.addEventListener('storage', update)
    const timer = window.setInterval(update, 5000)
    return () => {
      window.removeEventListener(OUTLOOK_SYNCED_EVENT, update)
      window.removeEventListener('storage', update)
      window.clearInterval(timer)
    }
  }, [email])
  return state
}

/** Open tasks that are overdue or due by tomorrow, soonest first. */
export function dueTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  const limit = new Date(now)
  limit.setDate(limit.getDate() + 1)
  const cutoff = limit.toISOString().slice(0, 10)
  return tasks
    .filter(
      (task) =>
        task.dueDate &&
        task.dueDate.slice(0, 10) <= cutoff &&
        !task.completedAt &&
        !task.archivedAt &&
        !task.deletedAt &&
        !/complete|done|closed|cancel/i.test(task.status),
    )
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
}

interface MailNotificationsPanelProps {
  open: boolean
  onClose: () => void
  email: string
  /** Tasks to flag in the bell (see dueTasks). */
  tasks?: TaskRecord[]
}

/**
 * Bell drawer: the five most recent UNREAD incoming emails. Opening the bell does not mark
 * anything read; opening a message in Email does, through the mail provider.
 */
export function MailNotificationsPanel({ open, onClose, email, tasks = [] }: MailNotificationsPanelProps) {
  const navigate = useNavigate()
  const { unread, available } = useUnreadMail(email)
  const [connecting, setConnecting] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const connectOutlook = () => {
    setConnecting(true)
    setNote(null)
    // Microsoft's account picker; the page comes back here and mail starts syncing.
    void outlookToken(true, email).then((token) => {
      setConnecting(false)
      if (token) void syncOutlookNow(email, { incremental: false, mail: true })
      else setNote(graphTokenError() ?? 'Outlook was not connected.')
    })
  }

  /** Marks the email read with the mail provider (Outlook or Gmail), then opens it in Email. */
  const openMessage = (message: MailMessage) => {
    const rows = loadMailbox(email).map((row) => (row.id === message.id ? { ...row, read: true } : row))
    saveMailbox(email, rows)
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: { message: 'Marked read.', mode: 'graph' } }))
    void pushMailRead(message.id, true).catch(() => {
      const back = loadMailbox(email).map((row) => (row.id === message.id ? { ...row, read: false } : row))
      saveMailbox(email, back)
    })
    onClose()
    navigate(`/email?open=${encodeURIComponent(message.id)}`)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const shown = unread.slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/30 backdrop-blur-[1px]" data-testid="mail-notifications">
      <button type="button" className="flex-1 cursor-default" aria-label="Close notifications" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-(--shadow-drawer)" role="dialog" aria-modal="true" aria-label="Unread email notifications">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy-900">Notifications</h2>
            <p className="text-xs text-ink-muted">
              {available ? `${unread.length} unread email${unread.length === 1 ? '' : 's'}` : 'Incoming email'}
              {tasks.length > 0 && ` · ${tasks.length} task${tasks.length === 1 ? '' : 's'} due`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-lg border border-border p-2 text-ink-muted hover:bg-canvas">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto">
          {tasks.length > 0 && (
            <div className="border-b border-border" data-testid="task-notifications">
              <p className="px-5 pt-3 text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">Tasks due</p>
              <ul className="divide-y divide-border">
                {tasks.slice(0, 5).map((task) => {
                  const overdue = (task.dueDate ?? '').slice(0, 10) < new Date().toISOString().slice(0, 10)
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate('/tasks')
                        }}
                        className="flex w-full items-start gap-2 px-5 py-3 text-left transition-colors hover:bg-accent-soft/40"
                      >
                        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? 'text-attention' : 'text-ink-subtle'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy-900">{task.action || 'Task'}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {task.projectName || 'No project'} · {overdue ? 'Overdue' : 'Due'} {task.dueDate?.slice(0, 10)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {tasks.length > 5 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate('/tasks')
                  }}
                  className="w-full px-5 py-2 text-left text-xs font-semibold text-navy-900 hover:underline"
                >
                  View all {tasks.length} in Tasks
                </button>
              )}
            </div>
          )}
          {!available ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Inbox className="mb-3 h-8 w-8 text-ink-subtle" />
              <p className="text-sm font-semibold text-navy-900">Mailbox not connected</p>
              <p className="mt-1 text-xs text-ink-muted">Connect your mailbox to see new email here. Reading an email marks it read in Outlook too.</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  data-testid="bell-connect-outlook"
                  disabled={connecting}
                  onClick={connectOutlook}
                  className="h-9 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {connecting ? 'Opening Microsoft…' : 'Connect Outlook'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate('/email')
                  }}
                  className="h-9 rounded-lg border border-border px-4 text-sm font-semibold text-ink hover:bg-canvas"
                >
                  Gmail and more
                </button>
              </div>
              {note && <p className="mt-2 text-xs text-attention">{note}</p>}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center" data-testid="mail-notifications-empty">
              <Mail className="mb-3 h-8 w-8 text-ink-subtle" />
              <p className="text-sm font-semibold text-navy-900">No unread emails</p>
              <p className="mt-1 text-xs text-ink-muted">You are all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    data-testid={`mail-notification-${message.id}`}
                    onClick={() => openMessage(message)}
                    className="w-full px-5 py-3 text-left transition-colors hover:bg-accent-soft/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#f5b301]" aria-hidden />
                      <span className="sr-only">Unread. </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{message.from || 'Unknown sender'}</span>
                      <span className="shrink-0 text-[11px] text-ink-subtle">{formatMailTime(message.at)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-navy-900">{message.subject || '(no subject)'}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      <span className="mr-1 text-[10px] font-semibold text-ink-subtle uppercase">{mailProvider(message) === 'gmail' ? 'Gmail' : 'Outlook'}</span>
                      {message.preview}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {available && unread.length > 5 && (
          <div className="border-t border-border px-5 py-3 text-center">
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/email')
              }}
              className="text-sm font-semibold text-navy-900 hover:underline"
            >
              View all {unread.length} in Email
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
