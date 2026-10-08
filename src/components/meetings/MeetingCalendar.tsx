import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { fetchKeyCalendar, getStoredSession, saveKeyCalendar } from '@/lib/api'
import {
  calendarOwnerKey,
  calendarOwnerLabel,
  eventsOnDate,
  loadCalendarEvents,
  monthGrid,
  saveCalendarEvents,
  todayISO,
  type CalendarEvent,
} from '@/lib/meetingCalendar'
import { pushCalendarReminders } from '@/lib/calendarReminders'
import { FIELD_LIMITS, sanitizeCalendarEvent } from '@/lib/meetingSecurity'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function newEvent(date: string): CalendarEvent {
  return {
    id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    time: '',
    title: '',
    notes: '',
    remind: true,
  }
}

export function MeetingCalendar() {
  const { user } = useAuth()
  const owner = calendarOwnerKey(user)
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [selected, setSelected] = useState(todayISO())
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents(owner))
  const [draft, setDraft] = useState<CalendarEvent>(() => newEvent(todayISO()))
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const local = loadCalendarEvents(owner)
    setEvents(local)
    if (getStoredSession()?.token === 'local-demo') {
      pushCalendarReminders(user, local)
      return
    }
    void fetchKeyCalendar()
      .then((data) => {
        if (data.events?.length) {
          setEvents(data.events)
          saveCalendarEvents(owner, data.events)
          pushCalendarReminders(user, data.events)
        } else {
          pushCalendarReminders(user, local)
        }
      })
      .catch(() => {
        pushCalendarReminders(user, local)
      })
  }, [owner, user])

  const persist = (next: CalendarEvent[]) => {
    setEvents(next)
    saveCalendarEvents(owner, next)
    pushCalendarReminders(user, next)
    if (getStoredSession()?.token === 'local-demo') return
    void saveKeyCalendar(next).catch(() => undefined)
  }

  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) map.set(e.date, (map.get(e.date) ?? 0) + 1)
    return map
  }, [events])

  const dayEvents = eventsOnDate(events, selected)
  const today = todayISO()
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const saveDraft = () => {
    if (!draft.title.trim() && !draft.notes.trim()) {
      setMessage('Add a title or notes for this day.')
      return
    }
    const nextItem = sanitizeCalendarEvent({
      ...draft,
      date: selected,
      title: draft.title.trim() || 'Meeting note',
    })
    if (!nextItem) {
      setMessage('That calendar entry could not be saved.')
      return
    }
    const exists = events.some((e) => e.id === nextItem.id)
    const next = exists
      ? events.map((e) => (e.id === nextItem.id ? nextItem : e))
      : [...events, nextItem]
    persist(next)
    setDraft(newEvent(selected))
    setMessage(
      nextItem.remind
        ? 'Saved on your key calendar. A reminder will appear in Notifications.'
        : 'Saved on your key calendar.',
    )
  }

  const remove = (id: string) => {
    persist(events.filter((e) => e.id !== id))
    if (draft.id === id) setDraft(newEvent(selected))
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-brand text-lg font-semibold text-navy-900">Calendar</h2>
          <p className="text-[11px] text-ink-subtle">{calendarOwnerLabel(user)} · private to this key</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
              )
            }
            className="rounded-lg border border-border p-1.5 text-ink-muted hover:bg-canvas"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[8.5rem] text-center text-sm font-semibold text-ink">{monthLabel}</p>
          <button
            type="button"
            onClick={() =>
              setCursor((c) =>
                c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
              )
            }
            className="rounded-lg border border-border p-1.5 text-ink-muted hover:bg-canvas"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide text-ink-subtle uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="h-9" />
          const day = Number(date.slice(8))
          const isSelected = date === selected
          const isToday = date === today
          const count = counts.get(date) ?? 0
          return (
            <button
              key={date}
              type="button"
              onClick={() => {
                setSelected(date)
                setDraft(newEvent(date))
                setMessage(null)
              }}
              className={`relative flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-navy-900 text-white'
                  : isToday
                    ? 'bg-accent-soft text-navy-900'
                    : 'text-ink hover:bg-canvas'
              }`}
            >
              {day}
              {count > 0 && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-accent'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          {selected} · {dayEvents.length} item{dayEvents.length === 1 ? '' : 's'}
        </p>
        <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
          {dayEvents.length === 0 && (
            <li className="text-xs text-ink-muted">No notes on this day. Add one below.</li>
          )}
          {dayEvents.map((e) => (
            <li
              key={e.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-canvas px-2.5 py-1.5"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setDraft(e)}
              >
                <p className="truncate text-xs font-semibold text-ink">
                  {e.time ? `${e.time} · ` : ''}
                  {e.title}
                </p>
                {e.notes && <p className="truncate text-[11px] text-ink-muted">{e.notes}</p>}
              </button>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="rounded p-1 text-ink-subtle hover:bg-rose-50 hover:text-rose-700"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-2">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Meeting title"
            maxLength={FIELD_LIMITS.calendarTitle}
            className="h-9 w-full rounded-lg border border-border bg-canvas px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              className="h-9 rounded-lg border border-border bg-canvas px-2 text-sm outline-none focus:border-accent"
            />
            <label className="flex flex-1 items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={draft.remind}
                onChange={(e) => setDraft((d) => ({ ...d, remind: e.target.checked }))}
              />
              Remind me in Notifications
            </label>
          </div>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Notes for this day…"
            maxLength={FIELD_LIMITS.calendarNotes}
            rows={2}
            className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            onClick={saveDraft}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 text-xs font-semibold text-white hover:bg-navy-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Save to this day
          </button>
          {message && <p className="text-[11px] text-ink-muted">{message}</p>}
        </div>
      </div>
    </section>
  )
}
