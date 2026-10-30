import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, FileText, Link2, Loader2, Plus, Video } from 'lucide-react'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { useCrmMeetings } from '@/hooks/useCrmMeetings'
import { useData } from '@/data/DataContext'
import { MonthDots, monthRange } from '@/components/meetings/MonthDots'
import { MeetingWorkspace, meetingWhen } from '@/components/meetings/MeetingWorkspace'
import { AddMeetingDrawer } from '@/components/meetings/AddMeetingDrawer'
import { localDayOf } from '@/lib/calendarStore'
import { meetingFromEvent } from '@/lib/crmMeetings'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'

const DAY = 86_400_000

/**
 * Meetings: the signed-in user's Outlook calendar, upcoming meetings, team CRM meeting history,
 * and the transcript / AI summary workspace. Calls happen in Teams or Zoom, not in this page.
 */
export function MeetingsPage() {
  const navigate = useNavigate()
  const { opportunities } = useData()
  const api = useCrmMeetings()
  const [anchor, setAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selected, setSelected] = useState<CrmMeeting | null>(null)
  const [adding, setAdding] = useState(false)
  const { from, to } = useMemo(() => monthRange(anchor), [anchor])
  const month = useOutlookCalendar(from, to)
  const [[upFrom, upTo]] = useState(() => {
    const now = new Date()
    return [now, new Date(now.getTime() + 60 * DAY)] as const
  })
  const upcomingCal = useOutlookCalendar(upFrom, upTo)

  const savedByEvent = useMemo(() => new Map(api.meetings.filter((m) => m.outlookEventId).map((m) => [m.outlookEventId!, m])), [api.meetings])
  const history = useMemo(
    () => api.meetings.filter((m) => m.opportunityId).sort((a, b) => b.start.localeCompare(a.start)),
    [api.meetings],
  )

  const upcoming = useMemo(
    () => upcomingCal.events.filter((e) => new Date(e.end).getTime() >= upFrom.getTime()).sort((a, b) => a.start.localeCompare(b.start)),
    [upcomingCal.events, upFrom],
  )
  const dayEvents = useMemo(
    () => (selectedDay ? month.events.filter((e) => localDayOf(e.start) === selectedDay).sort((a, b) => a.start.localeCompare(b.start)) : []),
    [month.events, selectedDay],
  )
  const listed = selectedDay ? dayEvents : upcoming

  const openEvent = (event: OutlookEvent) => setSelected(savedByEvent.get(event.id) ?? meetingFromEvent(event))
  const projectName = (id: string | null) => opportunities.find((o) => o.id === id)?.projectName ?? '—'
  const connected = upcomingCal.status !== 'not_connected'
  const calState = month.status === 'not_connected' || upcomingCal.status === 'not_connected' ? 'not_connected' : month.status === 'error' ? 'error' : month.status

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Meetings</h1>
          <p className="mt-1 text-sm text-ink-muted">Your Outlook calendar, meeting history, transcripts and summaries. Join calls in Teams or Zoom.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800" data-testid="add-meeting">
          <Plus className="h-4 w-4" /> Add Meeting
        </button>
      </header>

      {calState === 'not_connected' && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-warning-bg px-6 py-2 text-sm text-warning lg:px-8">
          Your calendar comes from your Microsoft sign-in, the same as Email. Outlook is not connected right now
          {month.events.length || upcomingCal.events.length
            ? `, so the events shown are from the last time Outlook was reached${month.fetchedAt ? ` (${new Date(month.fetchedAt).toLocaleString()})` : ''}.`
            : ', so no calendar events are shown.'}
          <button type="button" onClick={() => void month.connect()} className="font-semibold underline">
            Connect Outlook
          </button>
        </div>
      )}
      {calState === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-border bg-attention-bg px-6 py-2 text-sm text-attention lg:px-8">
          {month.error}
          <button type="button" onClick={() => void month.refresh()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1600px] gap-4 px-6 py-6 lg:grid-cols-2 lg:px-8">
        <section className="h-[380px] rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)" aria-label="Calendar">
          <MonthDots
            anchor={anchor}
            events={month.events}
            selectedDay={selectedDay}
            onSelectDay={(day) => setSelectedDay(day === selectedDay ? null : day)}
            onMove={(step) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + step, 1))}
          />
        </section>

        <section className="flex h-[380px] flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card)" aria-label="Meeting history" data-testid="meeting-history-widget">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h2 className="font-brand text-lg font-bold text-navy-900">Meeting History</h2>
              <p className="text-xs text-ink-muted">Saved meetings linked to a project. Shared with your approved Newport team.</p>
            </div>
            <button type="button" onClick={() => navigate('/meetings/history')} className="text-sm font-semibold text-accent hover:underline" data-testid="meeting-history-view-all">
              View All
            </button>
          </div>
          <ul className="custom-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {history.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">No meetings saved yet. Open a meeting, link a project, and save it to history.</li>}
            {history.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setSelected(m)} className={`flex w-full items-center gap-3 px-5 py-3 text-left ${selected?.id === m.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}>
                  <span className="w-20 shrink-0 text-xs text-ink-muted">{new Date(m.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{meetingTitle(m)}</span>
                    <span className="block truncate text-xs text-ink-muted">{projectName(m.opportunityId)}</span>
                  </span>
                  {m.transcript && <FileText className="h-4 w-4 shrink-0 text-accent" aria-label="Has transcript" />}
                  {m.recordingUrl && <Link2 className="h-4 w-4 shrink-0 text-accent" aria-label="Has recording link" />}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex max-h-[640px] min-h-[360px] flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:h-[640px]" aria-label="Upcoming meetings">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-brand text-lg font-bold text-navy-900">
              {selectedDay ? `Meetings on ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Upcoming Meetings'}
            </h2>
            {selectedDay && (
              <button type="button" onClick={() => setSelectedDay(null)} className="text-xs font-semibold text-accent hover:underline">
                Show upcoming
              </button>
            )}
          </div>
          <ul className="custom-scroll max-h-[340px] divide-y divide-border overflow-y-auto" data-testid="upcoming-meetings">
            {(upcomingCal.status === 'loading' || month.status === 'loading') && listed.length === 0 && (
              <li className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
              </li>
            )}
            {listed.length === 0 && upcomingCal.status !== 'loading' && (
              <li className="px-5 py-6 text-sm text-ink-muted">
                {!connected && !upcomingCal.events.length ? 'Connect Outlook to see your meetings.' : selectedDay ? 'No meetings on this day.' : 'No upcoming meetings in the next 60 days.'}
              </li>
            )}
            {listed.map((event) => {
              const saved = savedByEvent.get(event.id)
              return (
                <li key={event.id}>
                  <button type="button" onClick={() => openEvent(event)} className={`flex w-full items-start gap-3 px-5 py-3 text-left ${selected?.outlookEventId === event.id ? 'bg-accent-soft/60' : 'hover:bg-accent-soft/30'}`}>
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">{saved ? meetingTitle(saved) : event.subject}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {meetingWhen(event)}
                        {saved?.opportunityId ? ` · ${projectName(saved.opportunityId)}` : ''}
                      </span>
                    </span>
                    {event.joinUrl && <Video className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-label={`${event.platform} link`} />}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-auto border-t border-border px-5 py-2 text-[11px] text-ink-subtle">
            Events come from your Outlook calendar. Teams calls are not recorded or transcribed by this CRM; upload a transcript after the meeting.
          </p>
        </section>

        <section className="min-h-[640px] overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:h-[640px]" aria-label="Meeting details">
          {selected ? (
            <MeetingWorkspace key={selected.id} api={api} meeting={selected} variant="main" onRemoved={() => setSelected(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <h2 className="font-brand text-lg font-bold text-navy-900">Transcript &amp; Notes</h2>
              <p className="max-w-sm text-sm text-ink-muted">Choose a meeting to link it to a project, upload a transcript, and review the AI summary and proposed follow-ups.</p>
              {api.service.reason && <p className="max-w-sm text-xs text-ink-subtle">{api.service.reason}</p>}
            </div>
          )}
        </section>
      </div>

      <AddMeetingDrawer
        open={adding}
        onClose={() => setAdding(false)}
        api={api}
        createOutlookEvent={upcomingCal.create}
        outlookConnected={connected}
        onSaved={(m) => {
          setSelected(m)
          void month.refresh()
          void upcomingCal.refresh()
        }}
      />
    </div>
  )
}
