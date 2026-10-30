import { useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { CreationDrawer } from '@/components/shared/CreationDrawer'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { EMAIL_PATTERN, meetingLinkInfo, validateNewEvent, zonedTimeToUtc, type NewCalendarEvent, type OutlookEvent } from '@/lib/graphCalendar'
import { cleanRecordingUrl, meetingFromEvent, newMeetingId } from '@/lib/crmMeetings'
import { TRANSCRIPT_ACCEPT, transcriptFormat } from '@/lib/transcript'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { todayDateInput } from '@/lib/calendarDate'
import { emptySummary, type CrmMeeting } from '@/types/crmMeeting'
import type { useCrmMeetings } from '@/hooks/useCrmMeetings'

type Api = ReturnType<typeof useCrmMeetings>

const userZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'

interface Props {
  open: boolean
  onClose: () => void
  api: Api
  /** Creates the Outlook event through Graph (same sign-in as Email). */
  createOutlookEvent: (input: NewCalendarEvent) => Promise<OutlookEvent>
  outlookConnected: boolean
  onSaved: (meeting: CrmMeeting) => void
}

function blank() {
  return {
    title: '',
    date: todayDateInput(),
    startTime: '10:00',
    endTime: '10:30',
    timeZone: userZone(),
    location: '',
    link: '',
    attendees: '',
    sendInvite: true,
    teams: false,
    opportunityId: null as string | null,
    contactIds: [] as string[],
    primaryContactId: null as string | null,
    recordingUrl: '',
    notes: '',
  }
}

/**
 * Add Meeting: same dimmed full-height drawer as New Opportunity. Nothing is saved until Save.
 * With "Create Outlook event" on, the event is made through Graph first; if Outlook refuses,
 * nothing is saved and the reason is shown. Off = a CRM record only; no invite is sent.
 */
export function AddMeetingDrawer({ open, onClose, api, createOutlookEvent, outlookConnected, onSaved }: Props) {
  const { user } = useAuth()
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const [form, setForm] = useState(blank)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm({ ...blank(), sendInvite: outlookConnected })
      setFile(null)
      setError(null)
    }
  }

  const dirty = JSON.stringify({ ...form, sendInvite: true }) !== JSON.stringify({ ...blank(), sendInvite: true }) || file != null
  const attendees = form.attendees.split(/[;,\s]+/).map((a) => a.trim()).filter(Boolean)
  const oppOptions = useMemo(
    () =>
      opportunities
        .filter((o) => o.projectName.trim())
        .sort((a, b) => a.projectName.localeCompare(b.projectName, undefined, { numeric: true }))
        .map((o) => ({ id: o.id, label: o.projectName, detail: dealIdFromOpportunity(o) })),
    [opportunities],
  )
  const contactOptions = useMemo(() => contactsApi.items.map((c) => ({ id: c.id, label: c.name, detail: [c.title, c.company].filter(Boolean).join(' · ') })), [contactsApi.items])

  const leave = () => {
    if (saving) return
    if (dirty) setConfirmLeave(true)
    else onClose()
  }

  const eventInput = (): NewCalendarEvent => ({
    subject: form.title,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    allDay: false,
    timeZone: form.timeZone,
    location: form.location,
    attendees,
    teams: form.teams,
    description: form.notes,
  })

  const problem = (() => {
    if (!form.opportunityId) return 'Choose the linked opportunity.'
    const p = validateNewEvent(eventInput())
    if (p) return p
    if (form.link.trim() && !meetingLinkInfo(form.link)) return 'The meeting link must start with https://'
    if (cleanRecordingUrl(form.recordingUrl) === null) return 'The recording link must start with https://'
    if (file && !transcriptFormat(file.name)) return 'Transcripts must be .txt, .vtt or .docx.'
    return null
  })()

  const save = async () => {
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const link = meetingLinkInfo(form.link)
      let meeting: CrmMeeting
      if (form.sendInvite) {
        const created = await createOutlookEvent(eventInput())
        meeting = { ...meetingFromEvent(created), joinUrl: created.joinUrl || link?.url || '', platform: created.platform ?? link?.platform ?? null }
      } else {
        const now = new Date().toISOString()
        meeting = {
          id: newMeetingId(),
          outlookEventId: null,
          outlookSubject: form.title.trim(),
          displayTitle: '',
          start: zonedTimeToUtc(form.date, form.startTime, form.timeZone).toISOString(),
          end: zonedTimeToUtc(form.date, form.endTime, form.timeZone).toISOString(),
          location: form.location.trim(),
          organizer: user ? { name: user.name, email: user.email } : null,
          attendees: attendees.map((email) => ({ name: '', email, type: 'required' as const, response: 'none' })),
          platform: link?.platform ?? null,
          joinUrl: link?.url ?? '',
          opportunityId: null,
          contactIds: [],
          primaryContactId: null,
          transcript: null,
          summary: emptySummary(),
          recordingUrl: '',
          notes: '',
          createdAt: now,
          updatedAt: now,
        }
      }
      const saved = api.save({
        ...meeting,
        opportunityId: form.opportunityId,
        contactIds: form.contactIds,
        primaryContactId: form.primaryContactId && form.contactIds.includes(form.primaryContactId) ? form.primaryContactId : null,
        recordingUrl: cleanRecordingUrl(form.recordingUrl) ?? '',
        notes: form.notes,
      })
      const final = file ? await api.uploadTranscript(saved, file) : saved
      onSaved(final)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? `${err.message} Nothing was saved.` : 'The meeting was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const label = 'block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase'
  const input = 'mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink'
  const badAttendees = attendees.filter((a) => !EMAIL_PATTERN.test(a))

  return (
    <CreationDrawer open={open} label="Add Meeting" testId="add-meeting-drawer" onRequestClose={leave}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="font-brand text-xl font-bold text-navy-900">Add Meeting</h2>
          <p className="text-sm text-ink-muted">Nothing is saved until you choose Save.</p>
        </div>
        <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className={label}>
            Title
            <input className={input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className={`${label} col-span-3 sm:col-span-1`}>
              Date
              <input type="date" className={input} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </label>
            <label className={label}>
              Start
              <input type="time" className={input} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </label>
            <label className={label}>
              End
              <input type="time" className={input} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </label>
          </div>
          <label className={label}>
            Time zone
            <input className={input} value={form.timeZone} onChange={(e) => setForm((f) => ({ ...f, timeZone: e.target.value }))} />
          </label>
          <label className={label}>
            Location
            <input className={input} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </label>

          <div className="rounded-lg border border-border bg-canvas p-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.sendInvite} disabled={!outlookConnected} onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))} />
              <span>
                Create the Outlook event and send invitations
                <span className="block text-xs text-ink-muted">
                  {outlookConnected
                    ? 'Uses your Microsoft sign-in. If Outlook refuses, nothing is saved.'
                    : 'Outlook is not connected, so this will be a CRM record only. No invitation will be sent.'}
                </span>
              </span>
            </label>
            {form.sendInvite && (
              <>
                <label className={`${label} mt-3`}>
                  Invitees (email addresses)
                  <input className={input} value={form.attendees} placeholder="name@company.com, other@company.com" onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))} />
                  {badAttendees.length > 0 && <span className="mt-1 block text-[11px] font-normal normal-case text-attention">Not an email address: {badAttendees.join(', ')}</span>}
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.teams} onChange={(e) => setForm((f) => ({ ...f, teams: e.target.checked }))} /> Teams meeting (where your organization allows it)
                </label>
              </>
            )}
          </div>

          <label className={label}>
            External meeting link (optional)
            <input className={input} value={form.link} placeholder="https://zoom.us/j/…" onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
          </label>
          <div>
            <span className={label}>Linked opportunity</span>
            <div className="mt-1">
              <SearchSelect value={form.opportunityId} options={oppOptions} onChange={(id) => setForm((f) => ({ ...f, opportunityId: id }))} placeholder="Search projects…" />
            </div>
          </div>
          <div>
            <span className={label}>Linked contacts (from Relationships)</span>
            <div className="mt-1">
              <MultiSearchSelect values={form.contactIds} options={contactOptions} onChange={(ids) => setForm((f) => ({ ...f, contactIds: ids }))} placeholder="Search relationships…" />
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
          <label className={label}>
            Transcript (optional)
            <input type="file" accept={TRANSCRIPT_ACCEPT} className="mt-1 block w-full text-sm font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span className="mt-1 block text-[11px] font-normal normal-case text-ink-subtle">.txt, .vtt (Teams) or .docx. A summary is created from it automatically when an approved AI service is configured.</span>
          </label>
          <label className={label}>
            Recording link (optional)
            <input className={input} value={form.recordingUrl} placeholder="https://…" onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))} />
          </label>
          <label className={label}>
            Notes
            <textarea className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-ink" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
        </div>
        <div className="shrink-0 border-t border-border bg-canvas px-5 py-3">
          {error && <p className="mb-2 text-xs text-attention" role="alert">{error}</p>}
          {!error && problem && dirty && <p className="mb-2 text-xs text-ink-muted">{problem}</p>}
          <button type="button" disabled={saving || Boolean(problem)} onClick={() => void save()} className="h-10 w-full rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50" data-testid="add-meeting-save">
            {saving ? 'Saving…' : form.sendInvite ? 'Save and send Outlook invite' : 'Save CRM record'}
          </button>
          <button type="button" onClick={leave} disabled={saving} className="mt-2 h-10 w-full rounded-lg text-sm font-semibold text-ink-muted hover:bg-white">
            Cancel
          </button>
        </div>
      </div>
      <UnsavedChangesDialog
        open={confirmLeave}
        saving={saving}
        error={error}
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
    </CreationDrawer>
  )
}
