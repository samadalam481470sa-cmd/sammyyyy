import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Send, X } from 'lucide-react'
import {
  fetchNotifications,
  markNotificationRead,
  sendNotification,
  type NotificationItem,
} from '@/lib/api'
import { getStoredSession } from '@/lib/api'
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { useAuth } from '@/auth/AuthContext'
import {
  loadCalendarEvents,
  calendarOwnerKey,
} from '@/lib/meetingCalendar'
import {
  loadKeyCalendarNotifications,
  pushCalendarReminders,
  saveKeyCalendarNotifications,
} from '@/lib/calendarReminders'

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
}

const SEED: NotificationItem[] = [
  {
    id: 'local-1',
    direction: 'inbound',
    from: 'counsel@hargrovelane.demo',
    to: 'dennis@newportspecialty.demo',
    subject: 'Re: Project Guardian — NDA countersignature',
    body: 'The NDA is ready for countersignature. Confirm board approval language before Friday.',
    read: false,
    relatedProject: 'Project Guardian',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'local-2',
    direction: 'inbound',
    from: 'mary@newportspecialty.demo',
    to: 'dennis@newportspecialty.demo',
    subject: 'Diligence pack — Project Beacon',
    body: 'Uploaded the latest diligence pack. Outstanding: call accountant on broker comps.',
    read: false,
    relatedProject: 'Project Beacon',
    createdAt: new Date().toISOString(),
  },
]

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [selected, setSelected] = useState<NotificationItem | null>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      const owner = calendarOwnerKey(user)
      pushCalendarReminders(user, loadCalendarEvents(owner))
      const reminders = loadKeyCalendarNotifications(user)
      if (getStoredSession()?.token === 'local-demo') {
        setItems([...reminders, ...loadDemoCollection('notifications', SEED)])
        return
      }
      try {
        const data = await fetchNotifications()
        setItems([...reminders, ...data.notifications])
      } catch {
        setItems([...reminders, ...loadDemoCollection('notifications', SEED)])
      }
    })()
  }, [open, user])

  if (!open) return null

  const onSelect = async (item: NotificationItem) => {
    setSelected(item)
    if (!item.read) {
      const next = items.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      setItems(next)
      if (item.id.startsWith('cal-reminder-')) {
        saveKeyCalendarNotifications(
          user,
          next.filter((n) => n.id.startsWith('cal-reminder-')),
        )
      } else if (getStoredSession()?.token === 'local-demo') {
        saveDemoCollection(
          'notifications',
          next.filter((n) => !n.id.startsWith('cal-reminder-')),
        )
      } else {
        try {
          await markNotificationRead(item.id)
        } catch {
          // ignore
        }
      }
    }
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (getStoredSession()?.token === 'local-demo') {
        const created: NotificationItem = {
          id: `local_${Date.now()}`,
          direction: 'outbound',
          from: 'dennis@newportspecialty.demo',
          to,
          subject,
          body,
          read: true,
          relatedProject: '',
          createdAt: new Date().toISOString(),
        }
        const next = [created, ...items]
        saveDemoCollection('notifications', next)
        setItems(next)
        window.open(
          `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
          '_blank',
        )
        setMessage('Logged outbound note and opened your work mailbox compose window.')
      } else {
        const created = await sendNotification({ to, subject, body })
        setItems((prev) => [created, ...prev])
        if (created.mailto) window.open(created.mailto, '_blank')
        setMessage('Notification logged. Work mailbox compose opened when available.')
      }
      setTo('')
      setSubject('')
      setBody('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  const unread = items.filter((n) => !n.read && n.direction === 'inbound').length

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/30 backdrop-blur-[1px]">
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-(--shadow-drawer)">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy-900">Work inbox</h2>
            <p className="text-xs text-ink-muted">
              Live deal notifications · {unread} unread
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-ink-muted hover:bg-canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void onSelect(item)}
                  className={`w-full px-5 py-3 text-left transition-colors hover:bg-accent-soft/40 ${
                    selected?.id === item.id ? 'bg-accent-soft/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-accent" />
                    <span className="truncate text-xs font-semibold text-ink">
                      {item.direction === 'inbound' ? item.from : `To ${item.to}`}
                    </span>
                    {!item.read && item.direction === 'inbound' && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-navy-900">{item.subject}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-subtle">{item.relatedProject}</p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="border-t border-border bg-canvas/50 px-5 py-4">
              <p className="text-xs tracking-wide text-ink-subtle uppercase">{selected.from}</p>
              <h3 className="mt-1 font-brand text-base font-bold text-navy-900">{selected.subject}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{selected.body}</p>
            </div>
          )}
        </div>

        <form onSubmit={(e) => void onSend(e)} className="border-t border-border p-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Compose to work email
          </p>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="colleague@newportspecialty.demo"
            required
            className="mb-2 h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
            className="mb-2 h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message body…"
            rows={3}
            className="mb-2 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Send notification
          </button>
          {message && <p className="mt-2 text-[11px] text-ink-muted">{message}</p>}
        </form>
      </aside>
    </div>
  )
}
