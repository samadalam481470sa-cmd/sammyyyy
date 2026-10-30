import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { eventsByDay } from '@/lib/calendarStore'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthRange(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const from = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
  return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 42) }
}

/** Month view with one dot per meeting (up to three) and "+N" for more. */
export function MonthDots({
  anchor,
  events,
  selectedDay,
  onSelectDay,
  onMove,
}: {
  anchor: Date
  events: OutlookEvent[]
  selectedDay: string | null
  onSelectDay: (day: string) => void
  onMove: (step: number) => void
}) {
  const { from } = monthRange(anchor)
  const byDay = eventsByDay(events)
  const today = dayKey(new Date())
  return (
    <div className="flex h-full flex-col" data-testid="meetings-month">
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-brand text-lg font-bold text-navy-900">{anchor.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
        <div className="flex">
          <button type="button" onClick={() => onMove(-1)} aria-label="Previous month" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-canvas">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} aria-label="Next month" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-canvas">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-0.5 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-[11px] font-semibold text-ink-subtle">
            {d}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
          const key = dayKey(date)
          const count = byDay.get(key)?.length ?? 0
          const inMonth = date.getMonth() === anchor.getMonth()
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-pressed={selectedDay === key}
              aria-label={`${date.toDateString()}: ${count} meeting${count === 1 ? '' : 's'}`}
              className={`flex min-h-10 flex-col items-center justify-start rounded-lg pt-1 text-sm ${selectedDay === key ? 'bg-accent-soft' : 'hover:bg-canvas'} ${inMonth ? 'text-ink' : 'text-ink-subtle'}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${key === today ? 'bg-navy-900 text-white' : ''}`}>{date.getDate()}</span>
              <span className="mt-0.5 flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: Math.min(3, count) }, (_, n) => (
                  <span key={n} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
                {count > 3 && <span className="text-[9px] leading-none font-semibold text-accent">+{count - 3}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
