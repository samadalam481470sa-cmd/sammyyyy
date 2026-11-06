import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, Inbox, Mail, X, CalendarDays } from 'lucide-react'
import type { TaskRecord } from '@/data/mockModules'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { allocateBellSpace, BELL_SIZES, todaysMeetings, type BellSizes } from '@/lib/bellSlots'
import { loadCrmMeetings } from '@/lib/crmMeetings'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import { formatMailTime, loadMailbox, mailProvider, saveMailbox, senderDisplayName, type MailMessage } from '@/lib/outlookMailbox'
import { graphTokenError, outlookToken } from '@/lib/outlookGraph'
import { OUTLOOK_SYNCED_EVENT, mailSyncHealth, pushMailRead, syncOutlookNow } from '@/lib/outlookSync'
import { overdueTaskList } from '@/lib/taskSort'
import { formatDate } from '@/utils/dashboard'

export interface UnreadMailState {
  /** Unread incoming Inbox mail, newest first. */
  unread: MailMessage[]
  /** A mailbox (Outlook or Gmail) is connected for this user. */
  available: boolean
  /** The most recent sync error from a connected provider, shown as-is. */
  error: string | null
}

function readUnread(email: string): UnreadMailState {
  const mailbox = email ? loadMailbox(email) : []
  const unread = mailbox
    .filter((message) => message.folder === 'inbox' && !message.read && !message.demo && !message.pending)
    .sort((a, b) => b.at.localeCompare(a.at))
  const health = mailSyncHealth(email)
  const connected = Object.values(health).some((row) => row && row.state !== 'not_connected')
  const hasMail = mailbox.some((message) => !message.demo)
  const failed = Object.values(health).find((row) => row?.state === 'failed' && row.error)
  return { unread, available: connected || hasMail, error: failed?.error ?? null }
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

/**
 * Bell task alerts: the same unfinished OVERDUE task list the Tasks page shows under Overdue,
 * so the two counts always match. These are task counts, not deal counts.
 */
export function dueTasks(tasks: TaskRecord[], now = new Date(), opportunities?: ReadonlyArray<{ id: string; status: string }>): TaskRecord[] {
  return overdueTaskList(tasks, now, opportunities)
}

interface MailNotificationsPanelProps {
  open: boolean
  onClose: () => void
  email: string
  /** Unfinished overdue tasks, already in priority/date order (see dueTasks). */
  tasks?: TaskRecord[]
}

/**
 * Bell drawer: today's meetings first, then overdue tasks, then the most recent UNREAD emails. The
 * number of preview rows comes from the drawer's measured height (see allocateBellSpace), so a normal
 * desktop window shows one screen with no scrollbar; headings always show the true totals. Opening the bell does not mark
 * anything read; opening a message in Email does, through the mail provider.
 */
export function MailNotificationsPanel(props: MailNotificationsPanelProps) {
  // The calendar is only asked once the drawer opens.
  if (!props.open) return null
  return <NotificationsDrawer {...props} />
}

const dayLinkFormat = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function NotificationsDrawer({ open, onClose, email, tasks = [] }: MailNotificationsPanelProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [[dayStart, dayEnd]] = useState(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return [start, new Date(start.getTime() + 24 * 3600_000)] as const
  })
  const calendar = useOutlookCalendar(dayStart, dayEnd)
  // Only this person's Outlook events and their own saved meetings; both are private to them.
  const meetings = useMemo(() => todaysMeetings(calendar.events, loadCrmMeetings(calendarOwnerKey(user)), dayStart, dayEnd), [calendar.events, user, dayStart, dayEnd])
  const { unread, available, error: mailError } = useUnreadMail(email)
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

  // Measure the list area so the preview counts fit it exactly. Short windows fall back to scrolling.
  const listRef = useRef<HTMLDivElement>(null)
  const [listHeight, setListHeight] = useState(640)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const measure = () => setListHeight(el.clientHeight)
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  // Row and heading heights as they really render (fonts, zoom), so the list fills its space exactly.
  const [sizes, setSizes] = useState<BellSizes>(BELL_SIZES)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const h = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().height : 0)
    const rowsOf = (section: Element | null) => (section ? [...section.querySelectorAll('li')].map(h) : [])
    const meetingSection = list.querySelector('[data-testid=meeting-notifications]')
    const taskSection = list.querySelector('[data-testid=task-notifications]')
    const mailSection = list.querySelector('[data-testid=mail-section]')
    const notice = list.querySelector('[data-testid=mail-notice], [data-mail-notice]')
    const next = { ...sizes }
    const rows = [...rowsOf(meetingSection), ...rowsOf(taskSection)]
    if (rows.length) next.row = Math.ceil(Math.max(...rows))
    const mailRowHeights = rowsOf(mailSection)
    if (mailRowHeights.length) next.mailRow = Math.ceil(Math.max(...mailRowHeights))
    const overheads = [meetingSection, taskSection].filter(Boolean).map((s) => h(s) - rowsOf(s).reduce((a, b) => a + b, 0))
    if (overheads.length) next.section = Math.ceil(Math.max(...overheads))
    if (mailSection) next.mailSection = Math.ceil(h(mailSection) - mailRowHeights.reduce((a, b) => a + b, 0))
    if (notice) next.mailNotice = Math.ceil(h(notice))
    const changed = (Object.keys(next) as (keyof BellSizes)[]).some((key) => next[key] !== sizes[key])
    if (changed) setSizes(next)
  })
  const mailRows = available && !(mailError && unread.length === 0) && unread.length > 0
  // One pixel of slack absorbs sub-pixel rounding at browser zoom levels.
  const slots = allocateBellSpace({ meetings: meetings.length, tasks: tasks.length, mail: unread.length, mailRows }, listHeight - 1, sizes)
  const shown = unread.slice(0, slots.mail)
  const hiddenMeetings = meetings.length - slots.meetings
  const sectionHeading = 'px-5 pt-2 pb-0.5 text-[11px] leading-4 font-semibold tracking-wide text-ink-subtle uppercase'
  const viewAll = 'flex w-full items-center justify-between gap-2 px-5 py-1 text-left text-xs leading-4 font-semibold text-navy-900 hover:underline'
  const rowButton = 'flex w-full items-start gap-2 px-5 py-1.5 text-left transition-colors hover:bg-accent-soft/40 focus-visible:bg-accent-soft/50 focus-visible:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/30 backdrop-blur-[1px]" data-testid="mail-notifications">
      <button type="button" className="flex-1 cursor-default" aria-label="Close notifications" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-(--shadow-drawer)" role="dialog" aria-modal="true" aria-label="Unread email notifications">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy-900">Notifications</h2>
            <p className="text-xs text-ink-muted">
              <span data-testid="bell-counts">
                {meetings.length} meeting{meetings.length === 1 ? '' : 's'} today · {tasks.length} overdue task{tasks.length === 1 ? '' : 's'} · {available ? `${unread.length} unread email${unread.length === 1 ? '' : 's'}` : 'email not connected'}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-lg border border-border p-2 text-ink-muted hover:bg-canvas">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="custom-scroll min-h-0 flex-1 overflow-y-auto" data-testid="bell-list">
          {meetings.length > 0 && (
            <div className="border-b border-border" data-testid="meeting-notifications">
              <p className={sectionHeading}>Today's meetings ({meetings.length})</p>
              <ul className="divide-y divide-border">
                {meetings.slice(0, slots.meetings).map((meeting) => (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      data-testid={`bell-meeting-${meeting.id}`}
                      onClick={() => {
                        onClose()
                        navigate(`/meetings?day=${dayLinkFormat(dayStart)}&event=${encodeURIComponent(meeting.id)}`)
                      }}
                      className={rowButton}
                    >
                      <CalendarDays className={`mt-0.5 h-4 w-4 shrink-0 ${meeting.past ? 'text-ink-subtle' : 'text-accent'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${meeting.past ? 'text-ink-muted' : 'text-navy-900'}`}>{meeting.title}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {timeOf(meeting.start)} – {timeOf(meeting.end)}
                          {meeting.platform ? ` · ${meeting.platform}` : ''}
                          {meeting.past ? ' · earlier today' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="bell-view-all-meetings"
                onClick={() => {
                  onClose()
                  navigate(`/meetings?day=${dayLinkFormat(dayStart)}`)
                }}
                className={viewAll}
              >
                <span>View all today's meetings</span>
                {hiddenMeetings > 0 && <span className="font-medium text-ink-muted" data-testid="bell-more-meetings">+{hiddenMeetings} more meeting{hiddenMeetings === 1 ? '' : 's'}</span>}
              </button>
            </div>
          )}
          {calendar.status === 'error' && !meetings.length && (
            <p className="border-b border-border px-5 py-2.5 text-xs text-ink-muted" data-testid="bell-calendar-error">Today's meetings could not be checked. {calendar.error}</p>
          )}
          {tasks.length > 0 && (
            <div className="border-b border-border" data-testid="task-notifications">
              <p className={sectionHeading}>Overdue tasks ({tasks.length})</p>
              <ul className="divide-y divide-border">
                {tasks.slice(0, slots.tasks).map((task) => {
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate(`/tasks?filter=overdue&select=${encodeURIComponent(task.id)}`)
                        }}
                        className={rowButton}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy-900">{task.action || 'Task'}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            Priority {task.priority} · {task.projectName || 'No project'} · was due {formatDate(task.dueDate)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {tasks.length > 0 && (
                <button
                  type="button"
                  data-testid="bell-view-all-tasks"
                  onClick={() => {
                    onClose()
                    navigate('/tasks?filter=overdue')
                  }}
                  className={viewAll}
                >
                  View all {tasks.length} in Tasks
                </button>
              )}
            </div>
          )}
          {!available ? (
            <div className="flex flex-col items-center px-6 py-4 text-center" data-testid="mail-notice">
              <Inbox className="mb-1.5 h-6 w-6 text-ink-subtle" />
              <p className="text-sm font-semibold text-navy-900">Mailbox not connected</p>
              <p className="mt-1 text-xs text-ink-muted">Connect your mailbox to see new email here. Reading an email marks it read in Outlook too.</p>
              <div className="mt-3 flex gap-2">
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
                  Open Email
                </button>
              </div>
              {note && <p className="mt-2 text-xs text-attention">{note}</p>}
            </div>
          ) : mailError && shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-4 text-center" data-testid="mail-notifications-error" data-mail-notice="">
              <Inbox className="mb-1.5 h-6 w-6 text-ink-subtle" />
              <p className="text-sm font-semibold text-navy-900">Mail could not be checked</p>
              <p className="mt-1 text-xs text-ink-muted">{mailError}</p>
            </div>
          ) : unread.length > 0 && shown.length === 0 ? (
            <p className={sectionHeading} data-testid="mail-notifications-overflow">Unread emails ({unread.length})</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-4 text-center" data-testid="mail-notifications-empty" data-mail-notice="">
              <Mail className="mb-1.5 h-6 w-6 text-ink-subtle" />
              <p className="text-sm font-semibold text-navy-900">No unread emails</p>
              <p className="mt-1 text-xs text-ink-muted">You are all caught up.</p>
            </div>
          ) : (
            <div data-testid="mail-section">
            <p className={sectionHeading}>Unread emails ({unread.length})</p>
            <ul className="divide-y divide-border">
              {shown.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    data-testid={`mail-notification-${message.id}`}
                    onClick={() => openMessage(message)}
                    title={message.preview || undefined}
                    className="w-full px-5 py-1.5 text-left transition-colors hover:bg-accent-soft/40 focus-visible:bg-accent-soft/50 focus-visible:outline-none"
                  >
                    <div className="flex items-center gap-2 text-xs leading-4">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#f5b301]" aria-hidden />
                      <span className="sr-only">Unread. </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{senderDisplayName(message) || 'Unknown sender'}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-ink-subtle uppercase">{mailProvider(message) === 'gmail' ? 'Gmail' : 'Outlook'}</span>
                      <span className="shrink-0 text-[11px] text-ink-subtle">{formatMailTime(message.at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm leading-5 font-semibold text-navy-900">{message.subject || '(no subject)'}</p>
                  </button>
                </li>
              ))}
            </ul>
            </div>
          )}
        </div>

        {available && (
          <div className="border-t border-border px-5 py-3 text-center">
            <button
              type="button"
              data-testid="bell-view-all-email"
              onClick={() => {
                onClose()
                navigate('/email?filter=unread')
              }}
              className="text-sm font-semibold text-navy-900 hover:underline"
            >
              {unread.length > 0 ? `View all ${unread.length} unread in Email` : 'View all in Email'}
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
