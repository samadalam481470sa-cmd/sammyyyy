import { useEffect, useMemo, useState } from 'react'
import { useData } from '@/data/DataContext'
import { useResource } from '@/hooks/useResource'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { cleanRecordingUrl, readTranscriptText } from '@/lib/crmMeetings'
import { meetingLinkInfo } from '@/lib/graphCalendar'
import type { CrmMeeting } from '@/types/crmMeeting'
import type { useCrmMeetings } from '@/hooks/useCrmMeetings'

export type MeetingsApi = ReturnType<typeof useCrmMeetings>

export interface MeetingDraft {
  displayTitle: string
  opportunityId: string | null
  contactIds: string[]
  primaryContactId: string | null
  notes: string
  joinUrl: string
}

const norm = (email: string | null | undefined) => (email ?? '').trim().toLowerCase()

/** Relationship ids whose email exactly matches an Outlook attendee or the organizer. */
export function matchContactsByEmail(meeting: Pick<CrmMeeting, 'attendees' | 'organizer'>, contacts: ContactRecord[]): string[] {
  const emails = new Set([...meeting.attendees.map((a) => norm(a.email)), norm(meeting.organizer?.email)].filter((e) => e.includes('@')))
  return contacts.filter((c) => c.email && emails.has(norm(c.email))).map((c) => c.id)
}

function draftFrom(m: CrmMeeting, autoContacts: string[] | null): MeetingDraft {
  return {
    displayTitle: m.displayTitle,
    opportunityId: m.opportunityId,
    contactIds: autoContacts ?? m.contactIds,
    primaryContactId: m.primaryContactId,
    notes: m.notes,
    joinUrl: m.joinUrl,
  }
}

/**
 * One meeting's editable CRM metadata, transcript, summary and actions. Shared by the Meetings
 * page panels, the Meeting History drawer and the Opportunity Profile drawer, so they all read
 * and write the same private meeting record.
 */
export function useMeetingController(api: MeetingsApi, meeting: CrmMeeting) {
  const { opportunities } = useData()
  const contactsApi = useResource<ContactRecord>('contacts', mockContacts)
  const stored =
    api.meetings.find((m) => m.id === meeting.id) ??
    (meeting.outlookEventId ? api.meetings.find((m) => m.outlookEventId === meeting.outlookEventId) : undefined) ??
    null
  const current = stored ?? meeting
  const matched = useMemo(() => matchContactsByEmail(current, contactsApi.items), [current, contactsApi.items])
  const [draft, setDraft] = useState<MeetingDraft>(() => draftFrom(current, stored ? null : matchContactsByEmail(current, contactsApi.items)))
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transcriptText, setTranscriptText] = useState<string | null>(null)

  useEffect(() => {
    setDraft(draftFrom(current, stored ? null : matchContactsByEmail(current, contactsApi.items)))
    setMessage(null)
    setError(null)
    // Reset only when switching meetings; live updates of the same record keep the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id])

  useEffect(() => {
    let alive = true
    setTranscriptText(null)
    if (current.transcript) void readTranscriptText(api.owner, current.id).then((t) => alive && setTranscriptText(t))
    return () => {
      alive = false
    }
  }, [api.owner, current.id, current.transcript])

  const dirty =
    !stored ||
    draft.displayTitle !== current.displayTitle ||
    draft.opportunityId !== current.opportunityId ||
    draft.notes !== current.notes ||
    draft.joinUrl !== current.joinUrl ||
    draft.primaryContactId !== current.primaryContactId ||
    JSON.stringify(draft.contactIds) !== JSON.stringify(current.contactIds)

  const persist = (extra: Partial<CrmMeeting> = {}): CrmMeeting | null => {
    if (!draft.opportunityId) {
      setError('Link an opportunity first. Only acquisition meetings linked to a project are kept in CRM history.')
      return null
    }
    const link = draft.joinUrl.trim() ? meetingLinkInfo(draft.joinUrl) : null
    if (draft.joinUrl.trim() && !link) {
      setError('Meeting links must be a valid https:// address.')
      return null
    }
    const primary = draft.primaryContactId && draft.contactIds.includes(draft.primaryContactId) ? draft.primaryContactId : null
    const saved = api.save({
      ...current,
      ...draft,
      joinUrl: link?.url ?? '',
      platform: link?.platform ?? (draft.joinUrl.trim() ? current.platform : current.platform),
      primaryContactId: primary,
      ...extra,
    })
    setError(null)
    return saved
  }

  const save = () => {
    const saved = persist()
    if (saved) setMessage(new Date(saved.start).getTime() > Date.now() ? 'Saved to CRM. It appears in Meeting History once the meeting has taken place.' : 'Saved to your private CRM meeting history.')
    return saved
  }

  const uploadTranscript = async (file: File) => {
    const saved = persist()
    if (!saved) return null
    setBusy('upload')
    setError(null)
    setMessage(null)
    try {
      const done = await api.uploadTranscript(saved, file)
      setMessage(done.summary.status === 'ready' ? 'Transcript saved and summarized.' : 'Transcript saved. The summary could not be created — see AI Summary.')
      return done
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The transcript could not be read.')
      return null
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

  const saveRecording = (value: string) => {
    const clean = cleanRecordingUrl(value)
    if (clean === null) {
      setError('Recording links must start with https://')
      return false
    }
    const saved = persist({ recordingUrl: clean })
    if (saved) setMessage(clean ? 'Recording link saved.' : 'Recording link removed.')
    return Boolean(saved)
  }

  const markTaskCreated = (actionId: string, taskId: string) => {
    const base = api.meetings.find((m) => m.id === current.id) ?? current
    api.save({ ...base, summary: { ...base.summary, proposedActions: base.summary.proposedActions.map((row) => (row.id === actionId ? { ...row, createdTaskId: taskId } : row)) } })
  }

  const oppOptions = useMemo(
    () =>
      [...opportunities]
        .filter((o) => o.projectName.trim())
        .sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0) || a.projectName.localeCompare(b.projectName, undefined, { numeric: true }))
        .map((o) => ({ id: o.id, label: o.projectName })),
    [opportunities],
  )
  const contactOptions = useMemo(
    () => contactsApi.items.map((c) => ({ id: c.id, label: c.name, detail: [c.title, c.company].filter(Boolean).join(' · ') })),
    [contactsApi.items],
  )

  return {
    api,
    stored,
    current,
    draft,
    setDraft,
    dirty,
    busy,
    setBusy,
    message,
    setMessage,
    error,
    setError,
    transcriptText,
    matched,
    contacts: contactsApi.items,
    oppOptions,
    contactOptions,
    opportunities,
    persist,
    save,
    uploadTranscript,
    retrySummary,
    saveRecording,
    markTaskCreated,
  }
}

export type MeetingController = ReturnType<typeof useMeetingController>
