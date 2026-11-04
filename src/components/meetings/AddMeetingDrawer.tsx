import { useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { CenteredModal, ModalHeader } from '@/components/shared/Overlay'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { EMAIL_PATTERN, meetingLinkInfo, zonedTimeToUtc } from '@/lib/graphCalendar'
import { cleanRecordingUrl, newMeetingId } from '@/lib/crmMeetings'
import { TRANSCRIPT_ACCEPT, TRANSCRIPT_MAX_BYTES, transcriptFormat } from '@/lib/transcript'
import { todayDateInput } from '@/lib/calendarDate'
import { emptySummary, type CrmMeeting } from '@/types/crmMeeting'
import type { MeetingsApi } from '@/components/meetings/useMeetingController'

const userZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'

interface Props {
  open: boolean
  onClose: () => void
  api: MeetingsApi
  onSaved: (meeting: CrmMeeting) => void
  /** Prefill the linked opportunity (from an Opportunity Profile). */
  seedOpportunityId?: string | null
}

function blank(seedOpportunityId: string | null = null) {
  return {
    title: '',
    opportunityId: seedOpportunityId,
    contactIds: [] as string[],
    primaryContactId: null as string | null,
    date: todayDateInput(),
    startTime: '09:00',
    endTime: '09:30',
    recordingUrl: '',
    notes: '',
    link: '',
    organizer: '',
    participants: '',
  }
}

/**
 * Add Meeting: records an ACQUISITION meeting that ALREADY HAPPENED in your private CRM history.
 * It never creates or sends an Outlook event (that stays in Email > Calendar > New Event).
 * A transcript, if attached, is summarized right away by the existing Gemini service.
 */
export function AddMeetingDrawer({ open, onClose, api, onSaved, seedOpportunityId = null }: Props) {
  const { user } = useAuth()
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const [form, setForm] = useState(() => blank(seedOpportunityId))
  const [file, setFile] = useState<File | null>(null)
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState<null | 'saving' | 'summarizing'>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(blank(seedOpportunityId))
      setFile(null)
      setMore(false)
      setError(null)
    }
  }
  const zone = userZone()

  const dirty = JSON.stringify(form) !== JSON.stringify(blank(seedOpportunityId)) || file != null
  const oppOptions = useMemo(
    () =>
      [...opportunities]
        .filter((o) => o.projectName.trim())
        .sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0))
        .map((o) => ({ id: o.id, label: o.projectName })),
    [opportunities],
  )
  const contactOptions = useMemo(() => contactsApi.items.map((c) => ({ id: c.id, label: c.name, detail: [c.title, c.company].filter(Boolean).join(' · ') })), [contactsApi.items])

  const leave = () => {
    if (saving) return
    if (dirty) setConfirmLeave(true)
    else onClose()
  }

  const start = (() => {
    try {
      return zonedTimeToUtc(form.date, form.startTime, zone)
    } catch {
      return null
    }
  })()
  const end = (() => {
    try {
      return zonedTimeToUtc(form.date, form.endTime, zone)
    } catch {
      return null
    }
  })()
  const participants = form.participants
    .split(/[;,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const problem = (() => {
    if (!form.title.trim()) return 'Enter the meeting title.'
    if (!form.opportunityId) return 'Choose the linked opportunity. Only acquisition meetings are kept in history.'
    if (!start || Number.isNaN(start.getTime())) return 'Enter the date and start time.'
    if (start.getTime() > Date.now()) return 'Add Meeting is for meetings that already happened. Schedule future meetings in Email › Calendar › New Event (Outlook).'
    if (end && end.getTime() < start.getTime()) return 'The end time is before the start time.'
    if (form.link.trim() && !meetingLinkInfo(form.link)) return 'The meeting link must be a valid https:// address.'
    if (cleanRecordingUrl(form.recordingUrl) === null) return 'The recording link must start with https://'
    if (file && !transcriptFormat(file.name)) return 'Transcripts must be .txt, .vtt or .docx.'
    if (file && file.size > TRANSCRIPT_MAX_BYTES) return 'The transcript file is larger than 10 MB.'
    return null
  })()

  const save = async () => {
    if (problem) {
      setError(problem)
      return
    }
    setSaving('saving')
    setError(null)
    try {
      const now = new Date().toISOString()
      const link = meetingLinkInfo(form.link)
      const organizerText = form.organizer.trim()
      const meeting: CrmMeeting = {
        id: newMeetingId(),
        outlookEventId: null,
        outlookSubject: form.title.trim(),
        displayTitle: '',
        start: start!.toISOString(),
        end: (end && end.getTime() >= start!.getTime() ? end : start!).toISOString(),
        location: '',
        organizer: organizerText
          ? EMAIL_PATTERN.test(organizerText)
            ? { name: '', email: organizerText }
            : { name: organizerText, email: '' }
          : user
            ? { name: user.name, email: user.email }
            : null,
        attendees: participants.map((p) => (EMAIL_PATTERN.test(p) ? { name: '', email: p, type: 'required' as const, response: 'none' } : { name: p, email: '', type: 'required' as const, response: 'none' })),
        platform: link?.platform ?? null,
        joinUrl: link?.url ?? '',
        opportunityId: form.opportunityId,
        contactIds: form.contactIds,
        primaryContactId: form.primaryContactId && form.contactIds.includes(form.primaryContactId) ? form.primaryContactId : null,
        transcript: null,
        summary: emptySummary(),
        recordingUrl: cleanRecordingUrl(form.recordingUrl) ?? '',
        notes: form.notes,
        createdAt: now,
        updatedAt: now,
      }
      const saved = api.save(meeting)
      let final = saved
      if (file) {
        setSaving('summarizing')
        try {
          final = await api.uploadTranscript(saved, file)
        } catch (err) {
          // The meeting is saved; the transcript problem is shown in its panel with a retry.
          setError(err instanceof Error ? `Meeting saved, but the transcript could not be read: ${err.message}` : 'Meeting saved, but the transcript could not be read.')
        }
      }
      onSaved(final)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? `${err.message} Nothing was saved.` : 'The meeting was not saved.')
    } finally {
      setSaving(null)
    }
  }

  const label = 'block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase'
  const input = 'mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

  return (
    <CenteredModal open={open} onRequestClose={leave} label="Add Meeting" width="max-w-2xl" testId="add-meeting-modal">
      <ModalHeader title="Add Meeting" subtitle="Add an acquisition meeting that already took place to your private CRM history. No Outlook invite is created or sent." onClose={leave} closeLabel="Close add meeting" />
      <div className="custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <label className={label}>
          Meeting Title *
          <input className={input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Management meeting — Project Apple" data-testid="add-meeting-title" />
        </label>
        <div>
          <span className={label}>Linked Opportunity *</span>
          <div className="mt-1" data-testid="add-meeting-opportunity">
            <SearchSelect value={form.opportunityId} options={oppOptions} onChange={(id) => setForm((f) => ({ ...f, opportunityId: id }))} placeholder="Search projects…" emptyText="No matching project" />
          </div>
        </div>
        <div>
          <span className={label}>Linked Contact(s)</span>
          <div className="mt-1">
            <MultiSearchSelect values={form.contactIds} options={contactOptions} onChange={(ids) => setForm((f) => ({ ...f, contactIds: ids, primaryContactId: f.primaryContactId && ids.includes(f.primaryContactId) ? f.primaryContactId : null }))} placeholder="Search relationships…" emptyText="No matching relationship" />
          </div>
          {form.contactIds.length > 1 && (
            <label className={`${label} mt-2`}>
              Primary contact (optional)
              <select className={input} value={form.primaryContactId ?? ''} onChange={(e) => setForm((f) => ({ ...f, primaryContactId: e.target.value || null }))}>
                <option value="">None</option>
                {form.contactIds.map((id) => (
                  <option key={id} value={id}>
                    {contactOptions.find((o) => o.id === id)?.label ?? 'Unavailable contact'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className={label}>
            Date *
            <input type="date" max={todayDateInput()} className={input} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="add-meeting-date" />
          </label>
          <label className={label}>
            Start *
            <input type="time" className={input} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
          </label>
          <label className={label}>
            End
            <input type="time" className={input} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
          </label>
          <p className="col-span-3 -mt-2 text-[11px] text-ink-subtle">Time zone: {zone}. Stored with the zone, so it shows correctly anywhere.</p>
        </div>
        <label className={label}>
          Transcript Upload
          <input type="file" accept={TRANSCRIPT_ACCEPT} className="mt-1 block w-full text-sm font-normal text-ink file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:text-sm file:font-semibold file:text-white" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="add-meeting-transcript" />
          <span className="mt-1 block text-[11px] font-normal normal-case text-ink-subtle">Optional. .txt, .vtt (Teams) or .docx. When attached, the AI summary and suggested follow-ups are created right after saving.</span>
        </label>
        <label className={label}>
          Recording URL
          <input className={input} value={form.recordingUrl} placeholder="https://… (Stream, SharePoint, Zoom cloud)" onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))} />
        </label>
        <label className={label}>
          Notes
          <textarea className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </label>
        <div className="rounded-lg border border-border">
          <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink" aria-expanded={more}>
            More details (optional): meeting link, organizer, participants
            <ChevronDown className={`h-4 w-4 transition-transform ${more ? 'rotate-180' : ''}`} />
          </button>
          {more && (
            <div className="space-y-3 border-t border-border px-3 py-3">
              <label className={label}>
                Meeting link
                <input className={input} value={form.link} placeholder="https://teams.microsoft.com/… · zoom.us/j/… · meet.google.com/…" onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
              </label>
              <label className={label}>
                Organizer
                <input className={input} value={form.organizer} placeholder={user?.name ?? 'Name or email'} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))} />
              </label>
              <label className={label}>
                Participants
                <input className={input} value={form.participants} placeholder="Names or emails, separated by commas" onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} />
              </label>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 space-y-2 border-t border-border bg-surface px-6 py-3">
        {error && <p className="text-xs text-attention" role="alert">{error}</p>}
        {saving === 'summarizing' && (
          <p className="flex items-center gap-2 text-xs text-navy-900">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Meeting saved. Summarizing the transcript…
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={leave} disabled={Boolean(saving)} className="h-10 flex-1 rounded-lg border border-border bg-surface text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={Boolean(saving) || Boolean(problem)} title={problem ?? undefined} className="h-10 flex-[2] rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50" data-testid="add-meeting-save">
            {saving ? 'Saving…' : 'Save to History'}
          </button>
        </div>
        {problem && !error && dirty && <p className="text-[11px] text-ink-muted">{problem}</p>}
      </div>
      <UnsavedChangesDialog
        open={confirmLeave}
        saving={Boolean(saving)}
        error={null}
        recordLabel="meeting"
        onSave={() => {
          setConfirmLeave(false)
          void save()
        }}
        onDiscard={() => {
          setConfirmLeave(false)
          onClose()
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </CenteredModal>
  )
}
