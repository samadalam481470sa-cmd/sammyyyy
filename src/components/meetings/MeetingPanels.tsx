import { useRef, useState, type ReactNode } from 'react'
import { Check, Copy, Download, ExternalLink, FileText, Link2, Loader2, Pencil, Plus, RefreshCw, Upload, Video } from 'lucide-react'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { readTranscriptSource } from '@/lib/crmMeetings'
import { meetingLinkInfo } from '@/lib/graphCalendar'
import { TRANSCRIPT_ACCEPT } from '@/lib/transcript'
import { useData } from '@/data/DataContext'
import { meetingTitle, type CrmMeeting, type ProposedAction } from '@/types/crmMeeting'
import type { MeetingController } from '@/components/meetings/useMeetingController'

export const LABEL = 'block text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase'
const INPUT = 'h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'
const SMALL_BTN = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-50'
const NAVY_BTN = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50'

export function meetingWhen(m: Pick<CrmMeeting, 'start' | 'end'>): string {
  const start = new Date(m.start)
  const end = new Date(m.end)
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t(start)}${end.getTime() > start.getTime() ? ` – ${t(end)}` : ''}`
}

export function platformOf(m: Pick<CrmMeeting, 'joinUrl' | 'platform' | 'location'>): string {
  const info = meetingLinkInfo(m.joinUrl)
  if (info) return info.platform === 'Other link' ? 'Other' : info.platform
  return m.platform ?? (m.location ? 'In person / other' : '—')
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  )
}

/** Meeting link: open/copy when present, otherwise an Add Meeting Link field (no dead buttons). */
function MeetingLink({ ctl }: { ctl: MeetingController }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(ctl.draft.joinUrl)
  const [copied, setCopied] = useState(false)
  const link = meetingLinkInfo(ctl.draft.joinUrl)
  if (link && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="meeting-link-actions">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={NAVY_BTN}>
          <Video className="h-3.5 w-3.5" /> Open Meeting Link
        </a>
        <button
          type="button"
          className={SMALL_BTN}
          onClick={() =>
            void navigator.clipboard?.writeText(link.url).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy Meeting Link'}
        </button>
        <button type="button" className="text-xs font-semibold text-ink-muted hover:underline" onClick={() => { setValue(ctl.draft.joinUrl); setEditing(true) }}>
          Change
        </button>
      </div>
    )
  }
  if (!editing) {
    return (
      <button type="button" className={SMALL_BTN} onClick={() => setEditing(true)} data-testid="add-meeting-link">
        <Plus className="h-3.5 w-3.5" /> Add Meeting Link
      </button>
    )
  }
  const valid = !value.trim() || Boolean(meetingLinkInfo(value))
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input className={INPUT} value={value} placeholder="https://teams.microsoft.com/… · zoom.us/j/… · meet.google.com/…" onChange={(e) => setValue(e.target.value)} autoFocus />
        <button
          type="button"
          className={NAVY_BTN + ' h-9'}
          disabled={!valid}
          onClick={() => {
            ctl.setDraft((d) => ({ ...d, joinUrl: meetingLinkInfo(value)?.url ?? '' }))
            setEditing(false)
          }}
        >
          Use link
        </button>
        <button type="button" className={SMALL_BTN + ' h-9'} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      {!valid && <p className="text-[11px] text-danger">Enter a valid https:// meeting link (Teams, Zoom, Google Meet or any other).</p>}
      {value.trim() && valid && <p className="text-[11px] text-ink-muted">Detected: {meetingLinkInfo(value)?.platform}. Save the meeting to keep it.</p>}
    </div>
  )
}

/**
 * Selected meeting details: Outlook title (with an optional CRM-only title), time, platform,
 * organizer, linked opportunity → linked contacts → participants, meeting and recording links.
 */
export function MeetingDetailsBody({ ctl, compact = false }: { ctl: MeetingController; compact?: boolean }) {
  const { current, draft, setDraft, stored } = ctl
  const [editTitle, setEditTitle] = useState(false)
  const [recording, setRecording] = useState('')
  const [addingRecording, setAddingRecording] = useState(false)
  const title = meetingTitle({ displayTitle: draft.displayTitle, outlookSubject: current.outlookSubject })
  const matched = new Set(ctl.matched)
  const linkedEmails = new Set(draft.contactIds.map((id) => ctl.contacts.find((c) => c.id === id)?.email?.toLowerCase()).filter(Boolean))

  return (
    <div className="space-y-3.5" data-testid="meeting-details">
      {!compact && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
            {current.outlookEventId ? 'Outlook meeting' : 'Past meeting added to CRM'}
            {stored ? ' · saved in your history' : ' · not saved'}
          </p>
          <div className="mt-0.5 flex items-start gap-2">
            <h2 className="min-w-0 flex-1 font-brand text-xl leading-tight font-bold text-navy-900" data-testid="meeting-title">{title}</h2>
            <button type="button" onClick={() => setEditTitle((v) => !v)} className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas" aria-label="Edit CRM display title" title="CRM display title">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          {draft.displayTitle.trim() && current.outlookSubject && <p className="text-[11px] text-ink-subtle">Outlook title: “{current.outlookSubject}”</p>}
        </div>
      )}
      {(editTitle || compact) && (
        <label className="block">
          <span className={LABEL}>CRM display title (optional)</span>
          <input className={`${INPUT} mt-1`} value={draft.displayTitle} placeholder={current.outlookSubject || 'Meeting title'} onChange={(e) => setDraft((d) => ({ ...d, displayTitle: e.target.value }))} />
          {current.outlookEventId && <span className="mt-0.5 block text-[11px] text-ink-subtle">Only the CRM shows this title. The Outlook event is never renamed.</span>}
        </label>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Row label="Date & time">{meetingWhen(current)}</Row>
        <Row label="Platform">{platformOf({ ...current, joinUrl: draft.joinUrl })}</Row>
        <Row label="Organizer">{current.organizer ? current.organizer.name || current.organizer.email : '—'}</Row>
        <Row label="Location">{current.location || '—'}</Row>
      </dl>

      <MeetingLink key={current.id} ctl={ctl} />

      <div>
        <span className={LABEL}>Linked Opportunity *</span>
        <div className="mt-1" data-testid="meeting-opportunity">
          <SearchSelect value={draft.opportunityId} options={ctl.oppOptions} onChange={(id) => setDraft((d) => ({ ...d, opportunityId: id }))} placeholder="Search projects…" emptyText="No matching project" />
        </div>
      </div>

      <div>
        <span className={LABEL}>Linked Contacts</span>
        <div className="mt-1">
          <MultiSearchSelect values={draft.contactIds} options={ctl.contactOptions} onChange={(ids) => setDraft((d) => ({ ...d, contactIds: ids, primaryContactId: d.primaryContactId && ids.includes(d.primaryContactId) ? d.primaryContactId : null }))} placeholder="Search relationships…" emptyText="No matching relationship" />
        </div>
        {draft.contactIds.some((id) => matched.has(id)) && <p className="mt-1 text-[11px] text-success">Matched to Relationships by attendee email. Remove any that do not belong.</p>}
        {draft.contactIds.length > 1 && (
          <label className="mt-2 block">
            <span className={LABEL}>Primary contact (optional)</span>
            <select className={`${INPUT} mt-1`} value={draft.primaryContactId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, primaryContactId: e.target.value || null }))}>
              <option value="">None</option>
              {draft.contactIds.map((id) => (
                <option key={id} value={id}>
                  {ctl.contactOptions.find((o) => o.id === id)?.label ?? 'Unavailable contact'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div>
        <span className={LABEL}>Participants ({current.attendees.length})</span>
        {current.attendees.length ? (
          <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="meeting-participants">
            {current.attendees.map((a) => {
              const isLinked = a.email && linkedEmails.has(a.email.toLowerCase())
              return (
                <li key={`${a.email}-${a.name}`} className={`rounded-full border px-2.5 py-0.5 text-xs ${isLinked ? 'border-accent-muted bg-accent-soft text-navy-900' : 'border-border bg-canvas text-ink'}`} title={a.email}>
                  {a.name || a.email}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-0.5 text-sm text-ink-subtle">No participants on the event.</p>
        )}
        <p className="mt-1 text-[11px] text-ink-subtle">Participants are not added to Relationships automatically.</p>
      </div>

      <div>
        <span className={LABEL}>Recording</span>
        <div className="mt-1">
          {current.recordingUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={current.recordingUrl} target="_blank" rel="noopener noreferrer" className={SMALL_BTN} data-testid="open-recording">
                <ExternalLink className="h-3.5 w-3.5" /> Open Recording
              </a>
              <button type="button" className="text-xs font-semibold text-ink-muted hover:underline" onClick={() => ctl.saveRecording('')}>
                Remove link
              </button>
            </div>
          ) : addingRecording ? (
            <div className="flex gap-2">
              <input className={INPUT} value={recording} placeholder="https://… (Stream, SharePoint, Zoom cloud)" onChange={(e) => setRecording(e.target.value)} autoFocus />
              <button type="button" className={NAVY_BTN + ' h-9'} disabled={!recording.trim()} onClick={() => { if (ctl.saveRecording(recording)) setAddingRecording(false) }}>
                Save
              </button>
              <button type="button" className={SMALL_BTN + ' h-9'} onClick={() => setAddingRecording(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={SMALL_BTN} onClick={() => setAddingRecording(true)} data-testid="add-recording-link">
              <Link2 className="h-3.5 w-3.5" /> Add Recording Link
            </button>
          )}
        </div>
      </div>

      <label className="block">
        <span className={LABEL}>Notes</span>
        <textarea className="mt-1 min-h-16 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
      </label>
    </div>
  )
}

/** Save / status line used under the details. */
export function MeetingSaveBar({ ctl, extra }: { ctl: MeetingController; extra?: ReactNode }) {
  const canSave = Boolean(ctl.draft.opportunityId) && ctl.dirty && !ctl.busy
  return (
    <div className="shrink-0 space-y-1.5 border-t border-border bg-surface px-4 py-3">
      {ctl.error && <p className="text-xs text-attention" role="alert">{ctl.error}</p>}
      {ctl.message && <p className="text-xs text-success" role="status">{ctl.message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => ctl.save()}
          className={`h-10 flex-1 rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'}`}
          data-testid="meeting-save"
        >
          {ctl.stored ? 'Save Changes' : 'Save to History'}
        </button>
        {extra}
      </div>
      {!ctl.draft.opportunityId && <p className="text-[11px] text-ink-subtle">Link an opportunity to save this acquisition meeting to your history.</p>}
    </div>
  )
}

function SummaryList({ title, items, omitEmpty = false }: { title: string; items: string[]; omitEmpty?: boolean }) {
  if (!items.length && omitEmpty) return null
  return (
    <section>
      <h4 className="text-[11px] font-semibold tracking-[0.08em] text-navy-900 uppercase">{title}</h4>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-subtle">None stated in the transcript.</p>
      )}
    </section>
  )
}

type PanelTab = 'transcript' | 'summary' | 'actions'

/**
 * Transcript | AI Summary | Actions. Summaries come only from the uploaded transcript through
 * the existing Gemini service on the Newport server; nothing is written in their place on failure.
 */
export function MeetingTranscriptPanel({ ctl, fill = true }: { ctl: MeetingController; fill?: boolean }) {
  const { users } = useData()
  const { current } = ctl
  const [tab, setTab] = useState<PanelTab>(current.summary.status === 'ready' ? 'summary' : 'transcript')
  const [taskFrom, setTaskFrom] = useState<ProposedAction | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const summary = current.summary
  const proposed = summary.proposedActions
  const openCount = proposed.filter((p) => !p.createdTaskId).length

  const onFile = async (file: File) => {
    const done = await ctl.uploadTranscript(file)
    if (done) setTab(done.summary.status === 'ready' ? 'summary' : 'transcript')
  }

  const ownerFor = (hint?: string) => {
    if (!hint) return null
    const h = hint.trim().toLowerCase()
    const exact = users.find((u) => u.name.toLowerCase() === h)
    if (exact) return exact.id
    const first = users.filter((u) => u.name.split(/\s+/)[0]?.toLowerCase() === h)
    return first.length === 1 ? first[0].id : null
  }

  const actionsList = (
    <div className="space-y-2" data-testid="proposed-actions">
      {proposed.length === 0 ? (
        <p className="text-sm text-ink-subtle">No follow-ups were stated in the transcript.</p>
      ) : (
        <ul className="space-y-2">
          {proposed.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="min-w-0 text-sm text-ink">
                {row.action}
                {(row.ownerHint || row.dueHint) && (
                  <span className="mt-0.5 block text-[11px] text-ink-muted">
                    {row.ownerHint && <>Owner named: {row.ownerHint}</>}
                    {row.ownerHint && row.dueHint && ' · '}
                    {row.dueHint && <>Timing stated: “{row.dueHint}” (suggestion)</>}
                  </span>
                )}
              </span>
              {row.createdTaskId ? (
                <span className="shrink-0 rounded bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success">Task created</span>
              ) : (
                <button type="button" onClick={() => setTaskFrom(row)} disabled={!current.opportunityId} className={NAVY_BTN + ' shrink-0'} data-testid="create-task-from-action">
                  <Plus className="h-3.5 w-3.5" /> Create Task
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const noTranscript = (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" data-testid="no-transcript">
      <FileText className="h-8 w-8 text-ink-subtle" />
      <p className="max-w-xs text-sm text-ink-muted">No transcript uploaded. Upload a transcript to generate a summary and suggested follow-ups.</p>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={ctl.busy === 'upload' || !ctl.draft.opportunityId} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50" data-testid="upload-transcript">
        {ctl.busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Transcript
      </button>
      <p className="text-[11px] text-ink-subtle">{ctl.draft.opportunityId ? '.txt, .vtt (Teams) or .docx · kept privately in this browser' : 'Link an opportunity first.'}</p>
    </div>
  )

  return (
    <div className={`flex min-h-0 flex-col ${fill ? 'h-full' : ''}`} data-testid="meeting-transcript-panel">
      <div className="flex shrink-0 border-b border-border" role="tablist" aria-label="Transcript, summary and actions">
        {([
          ['transcript', 'Transcript'],
          ['summary', 'AI Summary'],
          ['actions', `Actions${openCount ? ` (${openCount})` : ''}`],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'}`} data-testid={`meeting-tab-${id}`}>
            {label}
          </button>
        ))}
      </div>
      <div className={`custom-scroll min-h-0 space-y-3 overflow-y-auto p-4 ${fill ? 'flex-1' : ''}`}>
        {ctl.busy === 'upload' && (
          <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-navy-900">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the transcript and asking the AI service for a summary…
          </p>
        )}
        {tab === 'transcript' &&
          (current.transcript ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
                  <FileText className="h-4 w-4 shrink-0 text-accent" />
                  <span className="truncate font-semibold">{current.transcript.fileName}</span>
                  <span className="shrink-0 text-xs text-ink-muted">· {current.transcript.chars.toLocaleString()} chars</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={SMALL_BTN} data-testid="download-transcript" onClick={() => void readTranscriptSource(ctl.api.owner, current.id).then((b) => (b ? saveBlob(b, current.transcript!.fileName) : ctl.setError('The transcript file is not stored in this browser.')))}>
                    <Download className="h-3.5 w-3.5" /> Download {current.transcript.format.toUpperCase()}
                  </button>
                  {current.transcript.format !== 'txt' && (
                    <button type="button" className={SMALL_BTN} disabled={!ctl.transcriptText} onClick={() => ctl.transcriptText && saveBlob(new Blob([ctl.transcriptText], { type: 'text/plain' }), current.transcript!.fileName.replace(/\.[^.]+$/, '') + '.txt')}>
                      <Download className="h-3.5 w-3.5" /> TXT
                    </button>
                  )}
                  <button type="button" className={SMALL_BTN} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Replace
                  </button>
                </div>
              </div>
              <pre className="rounded-lg bg-canvas p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-ink">{ctl.transcriptText ?? 'Loading transcript…'}</pre>
            </>
          ) : (
            noTranscript
          ))}

        {tab === 'summary' &&
          (!current.transcript ? (
            noTranscript
          ) : ctl.busy === 'summary' || summary.status === 'pending' && ctl.busy ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Summarizing the transcript…
            </p>
          ) : summary.status === 'ready' ? (
            <div className="space-y-4" data-testid="ai-summary">
              <p className="text-[11px] text-ink-subtle">
                From the uploaded transcript only · {summary.provider} · {summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : ''}
              </p>
              {summary.error && <p className="text-xs text-warning">{summary.error}</p>}
              {summary.overview ? (
                <section>
                  <h4 className="text-[11px] font-semibold tracking-[0.08em] text-navy-900 uppercase">Meeting overview</h4>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{summary.overview}</p>
                </section>
              ) : (
                <SummaryList title="Key points discussed" items={summary.discussion} />
              )}
              {summary.overview && summary.discussion.length > 0 && <SummaryList title="Key points discussed" items={summary.discussion} />}
              <SummaryList title="Key decisions" items={summary.decisions} />
              <SummaryList title="Outstanding questions" items={summary.openQuestions} omitEmpty />
              <SummaryList title="Next steps" items={summary.nextSteps} />
              <section>
                <h4 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-navy-900 uppercase">Proposed follow-ups</h4>
                {actionsList}
              </section>
            </div>
          ) : (
            <div className="space-y-2 py-4" data-testid="summary-unavailable">
              <p className="text-sm font-semibold text-navy-900">Summary unavailable</p>
              <p className="text-sm text-ink-muted">
                {summary.status === 'pending' ? 'The last summary request did not finish (the page was closed while it ran). Choose Retry.' : (summary.error ?? ctl.api.service.reason ?? 'No summary has been created yet.')}
              </p>
              <p className="text-xs text-ink-subtle">The transcript is saved. Nothing has been written in its place.</p>
              <button type="button" onClick={() => void ctl.retrySummary()} className={SMALL_BTN}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ))}

        {tab === 'actions' && (summary.status === 'ready' ? actionsList : <p className="py-6 text-center text-sm text-ink-muted">Proposed follow-ups appear after a transcript is summarized.</p>)}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={TRANSCRIPT_ACCEPT}
        className="hidden"
        data-testid="transcript-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void onFile(file)
        }}
      />

      <NewTaskDrawer
        open={taskFrom != null}
        onClose={() => setTaskFrom(null)}
        dueHint={taskFrom?.dueHint}
        seed={
          taskFrom
            ? {
                action: taskFrom.action,
                opportunityId: current.opportunityId,
                ownerId: ownerFor(taskFrom.ownerHint),
                notes: `Proposed in meeting “${meetingTitle(current)}” (${new Date(current.start).toLocaleDateString()}).${taskFrom.ownerHint ? ` Owner named in transcript: ${taskFrom.ownerHint}.` : ''}`,
              }
            : undefined
        }
        onCreated={(task) => {
          if (!taskFrom) return
          ctl.markTaskCreated(taskFrom.id, task.id)
          setTaskFrom(null)
          ctl.setMessage('Task created. It appears in Tasks, the Dashboard and the opportunity profile.')
        }}
      />
    </div>
  )
}
