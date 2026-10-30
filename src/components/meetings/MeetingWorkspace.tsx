import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, ExternalLink, FileText, Link2, Loader2, RefreshCw, Trash2, Upload, Video } from 'lucide-react'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord, type TaskRecord } from '@/data/mockModules'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { cleanRecordingUrl, readTranscriptSource, readTranscriptText } from '@/lib/crmMeetings'
import { TRANSCRIPT_ACCEPT } from '@/lib/transcript'
import { isWorkspaceShared, workspaceAiSelfTest } from '@/lib/workspaceSync'
import { todayDateInput } from '@/lib/calendarDate'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { meetingTitle, type CrmMeeting } from '@/types/crmMeeting'
import type { useCrmMeetings } from '@/hooks/useCrmMeetings'

type Api = ReturnType<typeof useCrmMeetings>
type PanelTab = 'transcript' | 'summary' | 'actions'

export function meetingWhen(m: Pick<CrmMeeting, 'start' | 'end'>): string {
  const start = new Date(m.start)
  const end = new Date(m.end)
  const day = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t(start)}${end.getTime() > start.getTime() ? ` – ${t(end)}` : ''}`
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">{title}</h4>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-subtle">None stated in the transcript.</p>
      )}
    </div>
  )
}

interface Props {
  api: Api
  meeting: CrmMeeting
  /** Two tabs on the Meetings page; three (with Proposed Actions) on Meeting History. */
  variant: 'main' | 'history'
  onRemoved?: () => void
}

/**
 * One meeting: Outlook facts (read-only), CRM-only title, linked opportunity and contacts,
 * transcript, AI summary from the transcript, proposed follow-ups and recording link.
 */
export function MeetingWorkspace({ api, meeting, variant, onRemoved }: Props) {
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const stored = api.meetings.find((m) => m.id === meeting.id) ?? null
  const current = stored ?? meeting
  const [draft, setDraft] = useState(() => ({
    displayTitle: current.displayTitle,
    opportunityId: current.opportunityId,
    contactIds: current.contactIds,
    primaryContactId: current.primaryContactId,
    notes: current.notes,
  }))
  const [recording, setRecording] = useState(current.recordingUrl)
  const [tab, setTab] = useState<PanelTab>('transcript')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transcriptText, setTranscriptText] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [taskFrom, setTaskFrom] = useState<{ id: string; action: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft({ displayTitle: current.displayTitle, opportunityId: current.opportunityId, contactIds: current.contactIds, primaryContactId: current.primaryContactId, notes: current.notes })
    setRecording(current.recordingUrl)
    setMessage(null)
    setError(null)
    setTab('transcript')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id])

  useEffect(() => {
    let alive = true
    setTranscriptText(null)
    if (current.transcript) void readTranscriptText(api.owner, current.id).then((t) => alive && setTranscriptText(t))
    return () => {
      alive = false
    }
  }, [api.owner, current.id, current.transcript])

  const oppOptions = useMemo(
    () =>
      opportunities
        .filter((o) => o.projectName.trim())
        .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { numeric: true }))
        .map((o) => ({ id: o.id, label: o.projectName, detail: dealIdFromOpportunity(o) })),
    [opportunities],
  )
  const contactOptions = useMemo(
    () => contactsApi.items.map((c) => ({ id: c.id, label: c.name, detail: [c.title, c.company].filter(Boolean).join(' · ') })),
    [contactsApi.items],
  )

  const dirty =
    !stored ||
    draft.displayTitle !== current.displayTitle ||
    draft.opportunityId !== current.opportunityId ||
    draft.notes !== current.notes ||
    draft.primaryContactId !== current.primaryContactId ||
    JSON.stringify(draft.contactIds) !== JSON.stringify(current.contactIds)
  const canSave = Boolean(draft.opportunityId) && dirty && !busy

  const persist = (extra: Partial<CrmMeeting> = {}): CrmMeeting | null => {
    if (!draft.opportunityId) {
      setError('Choose the linked opportunity first. A meeting joins CRM history only when it is linked to a project.')
      return null
    }
    const primary = draft.primaryContactId && draft.contactIds.includes(draft.primaryContactId) ? draft.primaryContactId : null
    const saved = api.save({ ...current, ...draft, primaryContactId: primary, ...extra })
    setError(null)
    return saved
  }

  const onUpload = async (file: File) => {
    const saved = persist()
    if (!saved) return
    setBusy('upload')
    setError(null)
    setMessage(null)
    try {
      const done = await api.uploadTranscript(saved, file)
      setMessage(done.summary.status === 'ready' ? 'Transcript saved and summarized.' : 'Transcript saved.')
      setTab(done.summary.status === 'ready' ? 'summary' : 'transcript')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The transcript could not be read.')
    } finally {
      setBusy(null)
    }
  }

  const [connection, setConnection] = useState<{ ok: boolean; text: string } | null>(null)
  const testConnection = async () => {
    setBusy('selftest')
    setConnection(null)
    try {
      const r = await workspaceAiSelfTest()
      setConnection({ ok: r.ok, text: `${r.message}${r.model ? ` · ${r.model}` : ''} · ${(r.ms / 1000).toFixed(1)} s` })
    } catch (err) {
      setConnection({ ok: false, text: err instanceof Error ? err.message : 'The Newport server could not be reached.' })
    } finally {
      setBusy(null)
    }
  }

  const retrySummary = async () => {
    setBusy('summary')
    try {
      await api.summarize(current)
    } finally {
      setBusy(null)
    }
  }

  const saveRecording = () => {
    const clean = cleanRecordingUrl(recording)
    if (clean === null) {
      setError('Recording links must start with https://')
      return
    }
    const saved = persist({ recordingUrl: clean })
    if (saved) setMessage(clean ? 'Recording link saved.' : 'Recording link removed.')
  }

  const title = meetingTitle({ displayTitle: draft.displayTitle, outlookSubject: current.outlookSubject })
  const summary = current.summary
  const proposed = summary.proposedActions
  const tabs: { id: PanelTab; label: string }[] =
    variant === 'history'
      ? [
          { id: 'transcript', label: 'Transcript' },
          { id: 'summary', label: 'AI Summary' },
          { id: 'actions', label: 'Proposed Actions' },
        ]
      : [
          { id: 'transcript', label: 'Transcript' },
          { id: 'summary', label: 'AI Summary' },
        ]

  const label = 'block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase'
  const inputCls = 'mt-1 h-9 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink'

  const proposedList = (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Proposed follow-ups</h4>
      {proposed.length === 0 ? (
        <p className="text-sm text-ink-subtle">No follow-ups were stated in the transcript.</p>
      ) : (
        <ul className="space-y-2">
          {proposed.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-ink">
                {row.action}
                {row.ownerHint && <span className="block text-xs text-ink-muted">Named in transcript: {row.ownerHint}</span>}
              </span>
              {row.createdTaskId ? (
                <span className="shrink-0 rounded bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success">Task created</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setTaskFrom({ id: row.id, action: row.action })}
                  disabled={!draft.opportunityId}
                  className="h-8 shrink-0 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                >
                  Create Task
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="meeting-workspace">
      <div className="custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
            {current.outlookEventId ? 'Outlook meeting' : 'CRM record only · no Outlook invite was sent'}
            {stored ? ' · in CRM history' : ' · not saved yet'}
          </p>
          <h2 className="mt-1 font-brand text-xl font-bold text-navy-900">{title}</h2>
          <p className="text-sm text-ink-muted">{meetingWhen(current)}</p>
        </div>

        <label className={label}>
          Display title (CRM only)
          <input className={inputCls} value={draft.displayTitle} placeholder={current.outlookSubject || 'Meeting title'} onChange={(e) => setDraft((d) => ({ ...d, displayTitle: e.target.value }))} />
          {current.outlookEventId && <span className="mt-1 block text-[11px] font-normal normal-case text-ink-subtle">Outlook subject: “{current.outlookSubject}”. Changing this title does not rename the Outlook event.</span>}
        </label>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className={label}>Organizer</dt>
            <dd className="mt-0.5 text-ink">{current.organizer ? current.organizer.name || current.organizer.email : '—'}</dd>
          </div>
          <div>
            <dt className={label}>Platform</dt>
            <dd className="mt-0.5 text-ink">{current.platform ?? (current.location || '—')}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={label}>Invitees ({current.attendees.length})</dt>
            <dd className="mt-0.5 text-ink">
              {current.attendees.length ? current.attendees.map((a) => a.name || a.email).join(', ') : 'No invitees on the event'}
            </dd>
          </div>
        </dl>

        {current.joinUrl && (
          <div className="flex flex-wrap gap-2">
            <a href={current.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800">
              <Video className="h-4 w-4" /> Open Meeting Link
            </a>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(current.joinUrl).then(() => setCopied(true))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-ink hover:bg-canvas"
            >
              <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy Meeting Link'}
            </button>
          </div>
        )}

        <div>
          <span className={label}>Linked opportunity</span>
          <div className="mt-1">
            <SearchSelect value={draft.opportunityId} options={oppOptions} onChange={(id) => setDraft((d) => ({ ...d, opportunityId: id }))} placeholder="Search projects…" emptyText="No matching project" />
          </div>
        </div>
        <div>
          <span className={label}>Linked contacts (from Relationships)</span>
          <div className="mt-1">
            <MultiSearchSelect values={draft.contactIds} options={contactOptions} onChange={(ids) => setDraft((d) => ({ ...d, contactIds: ids }))} placeholder="Search relationships…" emptyText="No matching relationship" />
          </div>
          {draft.contactIds.length > 1 && (
            <label className={`${label} mt-2`}>
              Primary contact (optional)
              <select className={inputCls} value={draft.primaryContactId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, primaryContactId: e.target.value || null }))}>
                <option value="">None</option>
                {draft.contactIds.map((id) => (
                  <option key={id} value={id}>
                    {contactOptions.find((o) => o.id === id)?.label ?? 'Unavailable contact'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mt-1 text-[11px] text-ink-subtle">Outlook attendees are not added to Relationships automatically.</p>
        </div>

        <div className="rounded-xl border border-border">
          <div className="flex border-b border-border" role="tablist" aria-label="Transcript and notes">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.id ? 'border-navy-900 text-navy-900' : 'border-transparent text-ink-muted hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-3 p-4">
            {tab === 'transcript' &&
              (current.transcript ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm text-ink">
                      <FileText className="h-4 w-4 text-accent" /> {current.transcript.fileName}
                      <span className="text-xs text-ink-muted">· {current.transcript.chars.toLocaleString()} characters · uploaded {new Date(current.transcript.uploadedAt).toLocaleDateString()}</span>
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void readTranscriptSource(api.owner, current.id).then((b) => b && saveBlob(b, current.transcript!.fileName))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-canvas">
                        <Download className="h-3.5 w-3.5" /> Original
                      </button>
                      <button type="button" disabled={!transcriptText} onClick={() => transcriptText && saveBlob(new Blob([transcriptText], { type: 'text/plain' }), current.transcript!.fileName.replace(/\.[^.]+$/, '') + '.txt')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-canvas disabled:opacity-50">
                        <Download className="h-3.5 w-3.5" /> Text
                      </button>
                      <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-canvas">
                        <Upload className="h-3.5 w-3.5" /> Replace
                      </button>
                    </div>
                  </div>
                  <pre className="custom-scroll max-h-72 overflow-auto rounded-lg bg-canvas p-3 font-sans text-xs whitespace-pre-wrap text-ink">{transcriptText ?? 'Loading transcript…'}</pre>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <p className="text-sm text-ink-muted">Upload a transcript to generate a meeting summary and proposed follow-ups.</p>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'upload' || !draft.opportunityId} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50" data-testid="upload-transcript">
                    {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Transcript
                  </button>
                  <p className="text-[11px] text-ink-subtle">{draft.opportunityId ? '.txt, .vtt (Teams) or .docx' : 'Choose the linked opportunity first.'}</p>
                </div>
              ))}

            {tab === 'summary' &&
              (!current.transcript ? (
                <p className="py-6 text-center text-sm text-ink-muted">Upload a transcript to generate a meeting summary and proposed follow-ups. A recording link alone does not produce a summary.</p>
              ) : busy === 'summary' ? (
                <p className="flex items-center gap-2 py-6 text-sm text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Summarizing the transcript…
                </p>
              ) : summary.status === 'ready' ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-ink-subtle">From the uploaded transcript only · {summary.provider} · {summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : ''}</p>
                  {summary.error && <p className="text-xs text-warning">{summary.error}</p>}
                  <Section title="Discussion" items={summary.discussion} />
                  <Section title="Decisions" items={summary.decisions} />
                  <Section title="Outstanding questions" items={summary.openQuestions} />
                  <Section title="Next steps" items={summary.nextSteps} />
                  {variant === 'main' && proposedList}
                </div>
              ) : (
                <div className="space-y-2 py-4" data-testid="summary-unavailable">
                  <p className="text-sm font-semibold text-navy-900">Summary unavailable</p>
                  <p className="text-sm text-ink-muted">
                    {summary.status === 'pending'
                      ? 'The last summary request did not finish (the page was closed or reloaded while it ran). Choose Retry.'
                      : (summary.error ?? api.service.reason ?? 'No summary has been created yet.')}
                  </p>
                  <p className="text-xs text-ink-subtle">The transcript is saved. Nothing has been written in its place.</p>
                  <button type="button" onClick={() => void retrySummary()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-canvas">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                  {isWorkspaceShared() && (
                    <button type="button" onClick={() => void testConnection()} disabled={busy === 'selftest'} className="ml-2 inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-canvas disabled:opacity-50" data-testid="ai-selftest">
                      {busy === 'selftest' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test AI connection
                    </button>
                  )}
                  {connection && (
                    <p className={`text-xs ${connection.ok ? 'text-success' : 'text-danger'}`} data-testid="ai-selftest-result">
                      {connection.text}
                    </p>
                  )}
                </div>
              ))}

            {tab === 'actions' &&
              (summary.status === 'ready' ? proposedList : <p className="py-6 text-center text-sm text-ink-muted">Proposed follow-ups appear after a transcript is summarized.</p>)}
          </div>
        </div>

        <div>
          <span className={label}>Recording link</span>
          {current.recordingUrl ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a href={current.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800">
                <ExternalLink className="h-4 w-4" /> Open Recording
              </a>
              <button type="button" onClick={() => { setRecording(''); const saved = persist({ recordingUrl: '' }); if (saved) setMessage('Recording link removed.') }} className="text-xs font-semibold text-ink-muted hover:underline">
                Remove link
              </button>
            </div>
          ) : (
            <div className="mt-1 flex gap-2">
              <input className={inputCls.replace('mt-1 ', '')} value={recording} placeholder="https://… (Stream, SharePoint, Zoom cloud)" onChange={(e) => setRecording(e.target.value)} />
              <button type="button" onClick={saveRecording} disabled={!recording.trim()} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-canvas disabled:opacity-50">
                <Link2 className="h-4 w-4" /> Add Recording Link
              </button>
            </div>
          )}
          <p className="mt-1 text-[11px] text-ink-subtle">Recordings stay where they are hosted. Only the link is kept here.</p>
        </div>

        <label className={label}>
          Notes
          <textarea className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-ink" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
        </label>
      </div>

      <div className="shrink-0 border-t border-border bg-canvas px-5 py-3">
        {error && <p className="mb-2 text-xs text-attention" role="alert">{error}</p>}
        {message && <p className="mb-2 text-xs text-success" role="status">{message}</p>}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            const saved = persist()
            if (saved) setMessage('Saved to your CRM meeting history.')
          }}
          className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'}`}
          data-testid="meeting-save"
        >
          {stored ? 'Save Changes' : 'Save to CRM History'}
        </button>
        {!draft.opportunityId && <p className="mt-1 text-[11px] text-ink-subtle">Link an opportunity to save this meeting to history.</p>}
        {stored && (
          <button type="button" onClick={() => setConfirmRemove(true)} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)]">
            <Trash2 className="h-4 w-4" /> Remove from CRM History
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={TRANSCRIPT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void onUpload(file)
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove from CRM History?"
        message="This removes the CRM record, its transcript and summary from this device. The Outlook event is not changed or deleted."
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void api.remove(current.id).then(() => onRemoved?.())
        }}
      />

      <NewTaskDrawer
        open={taskFrom != null}
        onClose={() => setTaskFrom(null)}
        seed={
          taskFrom
            ? {
                action: taskFrom.action,
                opportunityId: draft.opportunityId,
                dueDate: todayDateInput(new Date(Date.now() + 7 * 86_400_000)),
                notes: `Proposed in meeting “${title}” (${new Date(current.start).toLocaleDateString()}).`,
              }
            : undefined
        }
        onCreated={(task: TaskRecord) => {
          if (!taskFrom) return
          api.save({
            ...current,
            summary: { ...current.summary, proposedActions: current.summary.proposedActions.map((row) => (row.id === taskFrom.id ? { ...row, createdTaskId: task.id } : row)) },
          })
          setTaskFrom(null)
          setMessage('Task created. It now appears in Tasks, alerts and the opportunity profile.')
        }}
      />
    </div>
  )
}
