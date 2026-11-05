import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, FileText, Link2, Loader2, Plus, Video, X } from 'lucide-react'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { useSessionState } from '@/hooks/useSessionState'
import { useCrmMeetings } from '@/hooks/useCrmMeetings'
import { useData } from '@/data/DataContext'
import { MonthDots, monthRange } from '@/components/meetings/MonthDots'
import { AddMeetingDrawer } from '@/components/meetings/AddMeetingDrawer'
import { MeetingDetailsBody, MeetingSaveBar, MeetingTranscriptPanel, meetingWhen, platformOf } from '@/components/meetings/MeetingPanels'
import { useMeetingController, type MeetingController, type MeetingsApi } from '@/components/meetings/useMeetingController'
import { PageShell, PageTitleBar, PrimaryButton } from '@/components/shared/PageChrome'
import { DrawerHeader, SideDrawer } from '@/components/shared/Overlay'
import { localDayOf } from '@/lib/calendarStore'
import { meetingFromEvent } from '@/lib/crmMeetings'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'

const DAY = 86_400_000

const CtlContext = createContext<MeetingController | null>(null)

function SelectedMeetingProvider({ api, meeting, children }: { api: MeetingsApi; meeting: CrmMeeting; children: ReactNode }) {
  const ctl = useMeetingController(api, meeting)
  return <CtlContext.Provider value={ctl}>{children}</CtlContext.Provider>
}

function Card({ title, action, children, className = '', testId }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) ${className}`} data-testid={testId}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="min-w-0 truncate font-brand text-base font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EventRow({ event, saved, active, projectName, onOpen }: { event: OutlookEvent; saved?: CrmMeeting; active: boolean; projectName: (id: string | null) => string; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left ${active ? 'bg-accent-soft/70' : 'hover:bg-accent-soft/30'}`}>
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-navy-900">{saved ? meetingTitle(saved) : event.subject}</span>
          <span className="block truncate text-xs text-ink-muted">
            {meetingWhen(event)}
            {saved?.opportunityId ? ` · ${projectName(saved.opportunityId)}` : ''}
          </span>
        </span>
        {event.joinUrl && <Video className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-label={`${event.platform ?? 'Online'} meeting link`} />}
      </button>
    </li>
  )
}

/**
 * Meetings: three compact columns that fit the window.
 * Left: Outlook calendar above Upcoming Meetings. Center: the selected meeting above your saved
 * Meeting History. Right: Transcript / AI Summary / Actions. Meeting history is private to you.
 */
export function MeetingsPage() {
  const navigate = useNavigate()
  const { opportunities } = useData()
  const api = useCrmMeetings()
  // Fresh visits start on this month with nothing selected; Back from Meeting History or a profile restores all three.
  const [anchorIso, setAnchorIso] = useSessionState('meetings:anchor', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
  const anchor = useMemo(() => new Date(anchorIso), [anchorIso])
  const [selectedDay, setSelectedDay] = useSessionState<string | null>('meetings:day', null)
  // A saved meeting is kept by id so its transcript stays out of session storage; an Outlook-only one keeps its small snapshot.
  const [selectedRef, setSelectedRef] = useSessionState<{ id: string; snapshot: CrmMeeting | null } | null>('meetings:selected', null)
  const selected = selectedRef ? (api.meetings.find((m) => m.id === selectedRef.id) ?? selectedRef.snapshot) : null
  const setSelected = (meeting: CrmMeeting | null) => setSelectedRef(meeting ? { id: meeting.id, snapshot: api.meetings.some((m) => m.id === meeting.id) ? null : meeting } : null)
  const [adding, setAdding] = useState(false)
  const [allUpcoming, setAllUpcoming] = useState(false)
  const { from, to } = useMemo(() => monthRange(anchor), [anchor])
  const month = useOutlookCalendar(from, to)
  const [[upFrom, upTo]] = useState(() => {
    const now = new Date()
    return [now, new Date(now.getTime() + 60 * DAY)] as const
  })
  const upcomingCal = useOutlookCalendar(upFrom, upTo)

  const savedByEvent = useMemo(() => new Map(api.meetings.filter((m) => m.outlookEventId).map((m) => [m.outlookEventId!, m])), [api.meetings])
  const history = useMemo(
    () => api.meetings.filter((m) => m.opportunityId && new Date(m.start).getTime() <= Date.now()).sort((a, b) => b.start.localeCompare(a.start)),
    [api.meetings],
  )
  const upcoming = useMemo(() => {
    const seen = new Set<string>()
    return upcomingCal.events
      .filter((e) => !e.isCancelled && new Date(e.end).getTime() >= upFrom.getTime())
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [upcomingCal.events, upFrom])
  const dayEvents = useMemo(
    () => (selectedDay ? month.events.filter((e) => !e.isCancelled && localDayOf(e.start) === selectedDay).sort((a, b) => a.start.localeCompare(b.start)) : []),
    [month.events, selectedDay],
  )
  const listed = selectedDay ? dayEvents : upcoming

  const openEvent = (event: OutlookEvent) => setSelected(savedByEvent.get(event.id) ?? meetingFromEvent(event))
  const projectName = (id: string | null) => opportunities.find((o) => o.id === id)?.projectName ?? '—'
  const connected = upcomingCal.status !== 'not_connected'
  const calState = month.status === 'not_connected' || upcomingCal.status === 'not_connected' ? 'not_connected' : month.status === 'error' ? 'error' : month.status
  const loadingCal = (upcomingCal.status === 'loading' || month.status === 'loading') && listed.length === 0

  const page = (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-5 lg:grid-cols-[minmax(270px,0.82fr)_minmax(330px,1fr)_minmax(360px,1.18fr)] lg:overflow-hidden lg:px-8" data-testid="meetings-columns">
      {/* LEFT: calendar above upcoming meetings */}
      <div className="flex min-h-0 flex-col gap-4">
        <section className="shrink-0 rounded-xl border border-border bg-surface p-3 shadow-(--shadow-card)" aria-label="My Outlook Calendar">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="font-brand text-base font-bold text-navy-900">My Outlook Calendar</h2>
            {selectedDay && (
              <button type="button" onClick={() => setSelectedDay(null)} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-navy-900 hover:bg-accent-muted/60" data-testid="clear-day">
                {new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })} <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <MonthDots
            anchor={anchor}
            events={month.events}
            selectedDay={selectedDay}
            onSelectDay={(day) => setSelectedDay(day === selectedDay ? null : day)}
            onMove={(step) => setAnchorIso(new Date(anchor.getFullYear(), anchor.getMonth() + step, 1).toISOString())}
            compact
          />
        </section>

        <Card
          className="min-h-[220px] flex-1"
          testId="upcoming-card"
          title={selectedDay ? `Meetings on ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Upcoming Meetings'}
          action={
            selectedDay ? (
              <button type="button" onClick={() => setSelectedDay(null)} className="text-xs font-semibold text-accent hover:underline">
                Show upcoming
              </button>
            ) : (
              <button type="button" onClick={() => setAllUpcoming(true)} className="text-xs font-semibold text-accent hover:underline" data-testid="upcoming-view-all">
                View All
              </button>
            )
          }
        >
          <ul className="custom-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto" data-testid="upcoming-meetings">
            {loadingCal && (
              <li className="flex items-center gap-2 px-4 py-5 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
              </li>
            )}
            {!loadingCal && listed.length === 0 && (
              <li className="px-4 py-5 text-sm text-ink-muted">
                {!connected && !upcomingCal.events.length ? 'Connect Outlook to see your meetings.' : selectedDay ? 'No Outlook meetings on this day.' : 'No upcoming meetings in the next 60 days.'}
              </li>
            )}
            {listed.map((event) => (
              <EventRow key={event.id} event={event} saved={savedByEvent.get(event.id)} active={selected?.outlookEventId === event.id} projectName={projectName} onOpen={() => openEvent(event)} />
            ))}
          </ul>
        </Card>
      </div>

      {/* CENTER: selected meeting above history */}
      <div className="flex min-h-0 flex-col gap-4">
        <section className="flex min-h-[320px] flex-[3] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card)" aria-label="Selected meeting" data-testid="selected-meeting">
          <SelectedDetails />
        </section>
        <Card
          className="min-h-[200px] flex-[2]"
          testId="meeting-history-widget"
          title={
            <>
              Meeting History <span className="ml-1 text-xs font-normal text-ink-muted">(private to you)</span>
            </>
          }
          action={
            <button type="button" onClick={() => navigate('/meetings/history')} className="text-xs font-semibold text-accent hover:underline" data-testid="meeting-history-view-all">
              View All
            </button>
          }
        >
          <ul className="custom-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {history.length === 0 && <li className="px-4 py-5 text-sm text-ink-muted">No saved acquisition meetings yet. Select a past Outlook meeting, link a project and save it — or use Add Meeting.</li>}
            {history.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setSelected(m)} className={`flex w-full items-center gap-3 px-4 py-2 text-left ${selected?.id === m.id ? 'bg-accent-soft/70' : 'hover:bg-accent-soft/30'}`}>
                  <span className="w-[70px] shrink-0 text-xs text-ink-muted tabular-nums">{new Date(m.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}</span>
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
        </Card>
      </div>

      {/* RIGHT: transcript, AI summary and actions */}
      <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:min-h-0" aria-label="Transcript, AI summary and actions">
        <SelectedTranscript serviceReason={api.service.reason} />
      </section>
    </div>
  )

  return (
    <PageShell testId="meetings-page">
      <PageTitleBar title="Meetings" subtitle="Your Outlook calendar and your private history of acquisition meetings. Join calls in Teams, Zoom or Meet.">
        <PrimaryButton onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />} testId="add-meeting">
          Add Meeting
        </PrimaryButton>
      </PageTitleBar>

      {calState === 'not_connected' && (
        <div role="status" className="mx-6 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-1.5 text-xs text-warning lg:mx-8">
          Outlook is not connected right now
          {month.events.length || upcomingCal.events.length
            ? `, so the events shown are from the last time Outlook was reached${month.fetchedAt ? ` (${new Date(month.fetchedAt).toLocaleString()})` : ''}.`
            : ', so no calendar events are shown.'}
          <button type="button" onClick={() => void month.connect()} className="font-semibold underline">
            Connect Outlook
          </button>
        </div>
      )}
      {calState === 'error' && (
        <div role="alert" className="mx-6 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-attention-border bg-attention-bg px-3 py-1.5 text-xs text-attention lg:mx-8">
          {month.error}
          <button type="button" onClick={() => void month.refresh()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {selected ? (
        <SelectedMeetingProvider key={selected.id} api={api} meeting={selected}>
          {page}
        </SelectedMeetingProvider>
      ) : (
        <CtlContext.Provider value={null}>{page}</CtlContext.Provider>
      )}

      <SideDrawer open={allUpcoming} onRequestClose={() => setAllUpcoming(false)} label="All upcoming meetings" width="max-w-[480px]" testId="upcoming-drawer">
        <DrawerHeader title="Upcoming Meetings" subtitle={`${upcoming.length} Outlook event${upcoming.length === 1 ? '' : 's'} in the next 60 days`} onClose={() => setAllUpcoming(false)} closeLabel="Close upcoming meetings" />
        <ul className="custom-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {upcoming.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">{connected ? 'No upcoming meetings in the next 60 days.' : 'Connect Outlook to see your meetings.'}</li>}
          {upcoming.map((event, i) => {
            const day = localDayOf(event.start)
            const showDay = i === 0 || localDayOf(upcoming[i - 1].start) !== day
            return (
              <li key={event.id}>
                {showDay && <p className="bg-canvas px-5 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>}
                <button
                  type="button"
                  onClick={() => {
                    openEvent(event)
                    setAllUpcoming(false)
                  }}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent-soft/30"
                >
                  <span className="w-16 shrink-0 text-xs font-semibold text-navy-900 tabular-nums">{new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{savedByEvent.get(event.id) ? meetingTitle(savedByEvent.get(event.id)!) : event.subject}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {platformOf({ joinUrl: event.joinUrl, platform: event.platform, location: event.location })}
                      {event.organizer ? ` · ${event.organizer.name || event.organizer.email}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </SideDrawer>

      <AddMeetingDrawer open={adding} onClose={() => setAdding(false)} api={api} onSaved={(m) => setSelected(m)} />
    </PageShell>
  )
}

function SelectedDetails() {
  const ctl = useContext(CtlContext)
  if (!ctl) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 px-6 text-center" data-testid="meeting-empty">
        <CalendarDays className="h-8 w-8 text-ink-subtle" />
        <p className="font-brand text-lg font-bold text-navy-900">Select a meeting to view its details</p>
        <p className="max-w-xs text-sm text-ink-muted">Choose an Outlook event or a saved meeting. Link it to an opportunity to keep it in your history.</p>
      </div>
    )
  }
  return (
    <>
      <div className="custom-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <MeetingDetailsBody ctl={ctl} />
      </div>
      <MeetingSaveBar ctl={ctl} />
    </>
  )
}

function SelectedTranscript({ serviceReason }: { serviceReason: string | null }) {
  const ctl = useContext(CtlContext)
  if (!ctl) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <FileText className="h-8 w-8 text-ink-subtle" />
        <p className="font-brand text-lg font-bold text-navy-900">Transcript, AI Summary &amp; Actions</p>
        <p className="max-w-sm text-sm text-ink-muted">Select a meeting to upload its transcript, read the AI summary and turn proposed follow-ups into tasks.</p>
        {serviceReason && <p className="max-w-sm text-xs text-ink-subtle">{serviceReason}</p>}
      </div>
    )
  }
  return <MeetingTranscriptPanel ctl={ctl} />
}
