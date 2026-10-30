import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { eventsByDay, localDayOf } from '@/lib/calendarStore'
import {
  CalendarError,
  outlookCalendarWebUrl,
  validateNewEvent,
  EMAIL_PATTERN,
  type NewCalendarEvent,
  type OutlookEvent,
} from '@/lib/graphCalendar'
import { todayDateInput } from '@/lib/calendarDate'

type CalendarView = 'month' | 'week' | 'day'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function rangeFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
  if (view === 'week') {
    const from = addDays(startOfDay(anchor), -anchor.getDay())
    return { from, to: addDays(from, 7) }
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const from = addDays(first, -first.getDay())
  return { from, to: addDays(from, 42) }
}

export function formatEventTime(event: OutlookEvent): string {
  if (event.isAllDay) return 'All day'
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${fmt(event.start)} – ${fmt(event.end)}`
}

function shortTime(event: OutlookEvent) {
  return event.isAllDay ? 'All day' : new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const userZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
const ZONES = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'UTC']

/** Shown inside Email next to Mail. Uses the same Microsoft sign-in as Mail. */
export function EmailCalendar() {
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const cal = useOutlookCalendar(from, to)
  const byDay = useMemo(() => eventsByDay(cal.events), [cal.events])
  const dayEvents = byDay.get(selectedDay) ?? []
  const selected = cal.events.find((event) => event.id === selectedId) ?? null
  const today = dayKey(new Date())

  const move = (step: number) => {
    const next =
      view === 'month'
        ? new Date(anchor.getFullYear(), anchor.getMonth() + step, 1)
        : addDays(anchor, view === 'week' ? 7 * step : step)
    setAnchor(next)
    setSelectedDay(dayKey(view === 'month' ? next : next))
    setSelectedId(null)
  }

  const title =
    view === 'month'
      ? anchor.toLocaleDateString([], { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${from.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(to, -1).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
        : anchor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const openDay = (key: string) => {
    setSelectedDay(key)
    setSelectedId(null)
  }

  const personal = /@(outlook|hotmail|live|msn)\./i.test(cal.account)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white" data-testid="email-calendar">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e0e0e0] px-3 py-2">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-3 text-sm font-semibold text-white hover:bg-[#115ea3]"
          data-testid="calendar-new-event"
        >
          <Plus className="h-4 w-4" /> New event
        </button>
        <button
          type="button"
          onClick={() => {
            const now = startOfDay(new Date())
            setAnchor(now)
            setSelectedDay(dayKey(now))
          }}
          className="h-8 rounded-md border border-[#e0e0e0] px-3 text-sm font-semibold hover:bg-[#f5f5f5]"
        >
          Today
        </button>
        <div className="flex items-center">
          <button type="button" onClick={() => move(-1)} aria-label="Previous" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f5f5f5]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Next" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f5f5f5]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-base font-semibold" aria-live="polite">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {(['day', 'week', 'month'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setView(value)
                setAnchor(parseDayKey(selectedDay))
              }}
              aria-pressed={view === value}
              className={`h-8 rounded-md px-3 text-sm font-semibold capitalize ${view === value ? 'bg-[#ebf3fc] text-[#0f548c]' : 'hover:bg-[#f5f5f5]'}`}
            >
              {value}
            </button>
          ))}
          <button type="button" onClick={() => void cal.refresh()} aria-label="Refresh calendar" title="Refresh from Outlook" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f5f5f5]">
            <RefreshCw className={`h-4 w-4 ${cal.status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {cal.status === 'not_connected' && (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 bg-[#fff4ce] px-4 py-2 text-xs text-[#5c4300]">
          The calendar uses your Microsoft account, the same one as Outlook mail. {cal.error}
          <button type="button" onClick={() => void cal.connect()} className="font-semibold underline">
            Connect Outlook
          </button>
        </div>
      )}
      {cal.status === 'error' && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 bg-[#fdf3f4] px-4 py-2 text-xs text-[#a4262c]">
          {cal.error}
          <button type="button" onClick={() => void cal.refresh()} className="font-semibold underline">
            Try again
          </button>
          {cal.errorKind === 'consent' && (
            <button type="button" onClick={() => void cal.connect()} className="font-semibold underline">
              Connect Outlook
            </button>
          )}
          <a href={outlookCalendarWebUrl(personal)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Open Outlook calendar
          </a>
          {cal.fetchedAt && <span className="text-[#616161]">Showing events last loaded {new Date(cal.fetchedAt).toLocaleString()}.</span>}
        </div>
      )}
      {notice && (
        <div role="status" className="flex shrink-0 items-center gap-2 bg-[#f1faf1] px-4 py-2 text-xs text-[#0e700e]">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="custom-scroll min-h-0 flex-1 overflow-auto">
          {view === 'month' && (
            <div className="grid h-full min-h-[420px] grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))]">
              {WEEKDAYS.map((d) => (
                <div key={d} className="border-b border-[#e0e0e0] px-2 py-1 text-[11px] font-semibold text-[#616161]">
                  {d}
                </div>
              ))}
              {Array.from({ length: 42 }, (_, i) => {
                const date = addDays(from, i)
                const key = dayKey(date)
                const list = byDay.get(key) ?? []
                const inMonth = date.getMonth() === anchor.getMonth()
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(key)}
                    aria-label={`${date.toDateString()}, ${list.length} event${list.length === 1 ? '' : 's'}`}
                    aria-pressed={selectedDay === key}
                    className={`flex min-h-[72px] flex-col items-stretch gap-0.5 border-r border-b border-[#f0f0f0] p-1 text-left ${
                      selectedDay === key ? 'bg-[#ebf3fc]' : 'hover:bg-[#fafafa]'
                    } ${inMonth ? '' : 'text-[#a19f9d]'}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
                        key === today ? 'bg-[#0f6cbd] text-white' : ''
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {list.slice(0, 3).map((event) => (
                      <span key={event.id} className="truncate rounded bg-[#ebf3fc] px-1 text-[11px] text-[#0f548c]">
                        {shortTime(event)} {event.subject}
                      </span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[11px] font-semibold text-[#616161]">+{list.length - 3} more</span>}
                  </button>
                )
              })}
            </div>
          )}

          {view === 'week' && (
            <div className="grid min-h-full grid-cols-1 sm:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(from, i)
                const key = dayKey(date)
                const list = byDay.get(key) ?? []
                return (
                  <div key={key} className={`border-r border-b border-[#f0f0f0] ${selectedDay === key ? 'bg-[#f5f9fe]' : ''}`}>
                    <button type="button" onClick={() => openDay(key)} className="flex w-full items-center gap-2 border-b border-[#f0f0f0] px-2 py-1.5 text-left text-xs font-semibold">
                      <span className="text-[#616161]">{WEEKDAYS[i]}</span>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${key === today ? 'bg-[#0f6cbd] text-white' : ''}`}>{date.getDate()}</span>
                    </button>
                    <ul className="space-y-1 p-1.5">
                      {list.length === 0 && <li className="px-1 text-[11px] text-[#a19f9d]">No events</li>}
                      {list.map((event) => (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDay(key)
                              setSelectedId(event.id)
                            }}
                            className="w-full rounded border-l-2 border-[#0f6cbd] bg-[#ebf3fc] px-1.5 py-1 text-left text-[11px] text-[#0f548c]"
                          >
                            <span className="block font-semibold">{shortTime(event)}</span>
                            <span className="block truncate">{event.subject}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'day' && (
            <DayAgenda events={byDay.get(dayKey(anchor)) ?? []} selectedId={selectedId} onSelect={setSelectedId} />
          )}

          {cal.status === 'loading' && cal.events.length === 0 && (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-[#616161]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your Outlook calendar…
            </p>
          )}
        </div>

        <aside className="custom-scroll flex max-h-[45%] min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-[#e0e0e0] lg:max-h-none lg:w-[360px] lg:border-t-0 lg:border-l" aria-label="Selected day">
          {selected ? (
            <EventDetails event={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="p-4">
              <h3 className="text-sm font-semibold">{parseDayKey(selectedDay).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {dayEvents.length === 0 ? (
                <p className="mt-2 text-xs text-[#616161]">
                  {cal.status === 'ready' ? 'No events on this day.' : cal.status === 'loading' ? 'Loading…' : 'No events loaded for this day.'}
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <button type="button" onClick={() => setSelectedId(event.id)} className="w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-left hover:bg-[#f5f5f5]">
                        <span className="block text-xs text-[#616161]">{formatEventTime(event)}</span>
                        <span className="block truncate text-sm font-semibold">{event.subject}</span>
                        {event.location && <span className="block truncate text-xs text-[#616161]">{event.location}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {cal.fetchedAt && cal.status === 'ready' && (
                <p className="mt-4 text-[11px] text-[#a19f9d]">Loaded from Outlook {new Date(cal.fetchedAt).toLocaleTimeString()}.</p>
              )}
            </div>
          )}
        </aside>
      </div>

      {creating && (
        <NewEventDrawer
          initialDate={selectedDay < todayDateInput() ? todayDateInput() : selectedDay}
          onClose={() => setCreating(false)}
          onCreate={cal.create}
          personal={personal}
          onCreated={(event) => {
            setCreating(false)
            const key = localDayOf(event.start)
            setSelectedDay(key)
            setAnchor(parseDayKey(key))
            setSelectedId(event.id)
            setNotice(`"${event.subject}" was added to your Outlook calendar.${event.joinUrl ? ' A Teams link was created.' : ''}`)
            void cal.refresh()
          }}
        />
      )}
    </div>
  )
}

function DayAgenda({ events, selectedId, onSelect }: { events: OutlookEvent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!events.length) return <p className="px-4 py-6 text-sm text-[#616161]">No events on this day.</p>
  return (
    <ul className="divide-y divide-[#f0f0f0]">
      {events.map((event) => (
        <li key={event.id}>
          <button type="button" onClick={() => onSelect(event.id)} className={`flex w-full gap-4 px-4 py-3 text-left ${selectedId === event.id ? 'bg-[#ebf3fc]' : 'hover:bg-[#fafafa]'}`}>
            <span className="w-32 shrink-0 text-xs text-[#616161]">{formatEventTime(event)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{event.subject}</span>
              <span className="block truncate text-xs text-[#616161]">{[event.location, event.platform].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function EventDetails({ event, onBack }: { event: OutlookEvent; onBack?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="p-4 text-sm" data-testid="calendar-event-details">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0f548c] hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" /> Day
        </button>
      )}
      <h3 className="text-base font-semibold">{event.subject}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#616161]">
        <CalendarDays className="h-3.5 w-3.5" />
        {new Date(event.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {formatEventTime(event)}
      </p>
      {event.location && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#616161]">
          <MapPin className="h-3.5 w-3.5" /> {event.location}
        </p>
      )}
      {event.organizer && (
        <p className="mt-3 text-xs">
          <span className="font-semibold">Organizer:</span> {event.organizer.name || event.organizer.email}
          {event.organizer.name && event.organizer.email && <span className="text-[#616161]"> &lt;{event.organizer.email}&gt;</span>}
        </p>
      )}
      {event.attendees.length > 0 && (
        <div className="mt-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" /> Invitees ({event.attendees.length})
          </p>
          <ul className="mt-1 space-y-0.5">
            {event.attendees.map((a) => (
              <li key={`${a.email}-${a.name}`} className="truncate text-xs text-[#424242]">
                {a.name || a.email}
                {a.name && a.email && <span className="text-[#616161]"> &lt;{a.email}&gt;</span>}
                <span className="text-[#a19f9d]"> · {a.response === 'none' ? 'no response' : a.response}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {event.joinUrl && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f6cbd] px-3 text-xs font-semibold text-white hover:bg-[#115ea3]">
            <Video className="h-3.5 w-3.5" /> Join {event.platform ?? 'meeting'}
          </a>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(event.joinUrl).then(() => setCopied(true))
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 text-xs font-semibold hover:bg-[#f5f5f5]"
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
      {event.bodyPreview && <p className="mt-3 whitespace-pre-wrap text-xs text-[#424242]">{event.bodyPreview}</p>}
      {event.webLink && (
        <a href={event.webLink} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0f548c] hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Open in Outlook
        </a>
      )}
    </div>
  )
}

function emptyDraft(date: string): NewCalendarEvent {
  return {
    subject: '',
    date,
    startTime: '09:00',
    endTime: '09:30',
    allDay: false,
    timeZone: userZone(),
    location: '',
    attendees: [],
    teams: false,
    description: '',
  }
}

export function NewEventDrawer({
  initialDate,
  onClose,
  onCreate,
  onCreated,
  personal,
  title = 'New event',
}: {
  initialDate: string
  onClose: () => void
  onCreate: (input: NewCalendarEvent) => Promise<OutlookEvent>
  onCreated: (event: OutlookEvent) => void
  personal: boolean
  title?: string
}) {
  const [draft, setDraft] = useState(() => emptyDraft(initialDate))
  const [attendeeText, setAttendeeText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const initial = useMemo(() => JSON.stringify(emptyDraft(initialDate)), [initialDate])
  const attendees = attendeeText.split(/[;,\s]+/).map((a) => a.trim()).filter(Boolean)
  const current = { ...draft, attendees }
  const dirty = JSON.stringify({ ...draft, attendees: [] }) !== initial || attendees.length > 0
  const problem = validateNewEvent(current)
  const zones = ZONES.includes(draft.timeZone) ? ZONES : [draft.timeZone, ...ZONES]

  const leave = () => {
    if (saving) return
    if (dirty) setConfirmLeave(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const save = async () => {
    if (problem || saving) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await onCreate(current)
      onCreated(created)
    } catch (err) {
      // Nothing is stored locally when Outlook refuses or cannot be reached.
      setError(err instanceof CalendarError || err instanceof Error ? err.message : 'The event was not created.')
    } finally {
      setSaving(false)
    }
  }

  const label = 'block text-xs font-semibold tracking-[0.04em] text-[#616161] uppercase'
  const input = 'mt-1 h-9 w-full rounded-md border border-[#d1d1d1] px-2.5 text-sm outline-none focus:border-[#0f6cbd]'
  const badAttendees = attendees.filter((a) => !EMAIL_PATTERN.test(a))

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={title} data-testid="new-event-drawer">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-navy-950/40" onClick={leave} />
      <div className="relative flex h-dvh w-full max-w-[460px] flex-col bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e0e0e0] px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={leave} aria-label="Close" className="rounded-md p-1.5 hover:bg-[#f5f5f5]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className={label}>
            Title
            <input className={input} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} autoFocus />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft((d) => ({ ...d, allDay: e.target.checked }))} /> All day
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className={`${label} col-span-3 sm:col-span-1`}>
              Date
              <input type="date" className={input} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            </label>
            {!draft.allDay && (
              <>
                <label className={label}>
                  Start
                  <input type="time" className={input} value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} />
                </label>
                <label className={label}>
                  End
                  <input type="time" className={input} value={draft.endTime} onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))} />
                </label>
              </>
            )}
          </div>
          <label className={label}>
            Time zone
            <select className={input} value={draft.timeZone} onChange={(e) => setDraft((d) => ({ ...d, timeZone: e.target.value }))}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Location
            <input className={input} value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
          </label>
          <label className={label}>
            Attendees (email addresses)
            <input className={input} value={attendeeText} placeholder="name@company.com, other@company.com" onChange={(e) => setAttendeeText(e.target.value)} />
            {badAttendees.length > 0 && <span className="mt-1 block text-[11px] font-normal normal-case text-[#a4262c]">Not an email address: {badAttendees.join(', ')}</span>}
            {attendees.length > 0 && badAttendees.length === 0 && (
              <span className="mt-1 block text-[11px] font-normal normal-case text-[#616161]">Outlook sends invitations to these people when the event is saved.</span>
            )}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={draft.teams} onChange={(e) => setDraft((d) => ({ ...d, teams: e.target.checked }))} />
            <span>
              Teams meeting
              <span className="block text-[11px] text-[#616161]">
                {personal
                  ? 'Personal Microsoft accounts may not be allowed to create Teams links. If Outlook refuses, the event is not created and you will see why.'
                  : 'Outlook adds a Teams join link when your organization allows it.'}
              </span>
            </span>
          </label>
          <label className={label}>
            Description
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-[#d1d1d1] px-2.5 py-2 text-sm outline-none focus:border-[#0f6cbd]" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </label>
        </div>
        <div className="shrink-0 border-t border-[#e0e0e0] bg-[#fafafa] px-5 py-3">
          {error && <p role="alert" className="mb-2 text-xs text-[#a4262c]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || Boolean(problem)}
              className="h-9 flex-1 rounded-md bg-[#0f6cbd] text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="new-event-save"
            >
              {saving ? 'Saving to Outlook…' : 'Save'}
            </button>
            <button type="button" onClick={leave} disabled={saving} className="h-9 flex-1 rounded-md border border-[#d1d1d1] text-sm font-semibold hover:bg-[#f5f5f5]">
              Cancel
            </button>
          </div>
          {problem && dirty && !error && <p className="mt-2 text-[11px] text-[#616161]">{problem}</p>}
        </div>
        {confirmLeave && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 p-6">
            <div role="alertdialog" aria-label="Discard event" className="w-full max-w-sm rounded-lg border border-[#e0e0e0] bg-white p-4 shadow-lg">
              <p className="text-sm font-semibold">Discard this event?</p>
              <p className="mt-1 text-xs text-[#616161]">It has not been saved to Outlook.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={onClose} className="h-8 flex-1 rounded-md bg-[#a4262c] text-xs font-semibold text-white">
                  Discard
                </button>
                <button type="button" onClick={() => setConfirmLeave(false)} className="h-8 flex-1 rounded-md border border-[#d1d1d1] text-xs font-semibold">
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
