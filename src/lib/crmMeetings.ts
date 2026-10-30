/**
 * Private CRM meeting history for one signed-in owner. Records stay on this device and are not
 * sent to the shared workspace (sponsor permissions for sharing are still to be decided).
 * Transcript files and their text are kept in the browser's file store, not in static assets.
 */
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { deleteDocumentBlob, getDocumentBlob, putDocumentBlob } from '@/lib/documentFileStore'
import type { CrmMeeting } from '@/types/crmMeeting'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { emptySummary } from '@/types/crmMeeting'

export const CRM_MEETINGS_CHANGED = 'newport-crm-meetings-changed'

function collection(owner: string) {
  return `crm_meetings__${owner}`
}

export function loadCrmMeetings(owner: string): CrmMeeting[] {
  return loadDemoCollection<CrmMeeting>(collection(owner), []).filter((m) => typeof m?.id === 'string')
}

export function saveCrmMeetings(owner: string, rows: CrmMeeting[]): void {
  saveDemoCollection(collection(owner), rows)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CRM_MEETINGS_CHANGED, { detail: { owner } }))
}

export function upsertCrmMeeting(owner: string, meeting: CrmMeeting): CrmMeeting {
  const rows = loadCrmMeetings(owner)
  const next = { ...meeting, updatedAt: new Date().toISOString() }
  saveCrmMeetings(owner, [...rows.filter((m) => m.id !== meeting.id), next])
  return next
}

/** Removes only the CRM record and its stored transcript. The Outlook event is untouched. */
export async function removeCrmMeeting(owner: string, id: string): Promise<void> {
  saveCrmMeetings(owner, loadCrmMeetings(owner).filter((m) => m.id !== id))
  await deleteDocumentBlob(owner, transcriptTextKey(id)).catch(() => undefined)
  await deleteDocumentBlob(owner, transcriptSourceKey(id)).catch(() => undefined)
}

export function newMeetingId(): string {
  return `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** A draft CRM record from an Outlook event. Nothing is saved until the user saves it. */
export function meetingFromEvent(event: OutlookEvent): CrmMeeting {
  const now = new Date().toISOString()
  return {
    id: newMeetingId(),
    outlookEventId: event.id,
    outlookSubject: event.subject,
    displayTitle: '',
    start: event.start,
    end: event.end,
    location: event.location,
    organizer: event.organizer,
    attendees: event.attendees,
    platform: event.platform,
    joinUrl: event.joinUrl,
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

const transcriptTextKey = (id: string) => `meeting-transcript-text-${id}`
const transcriptSourceKey = (id: string) => `meeting-transcript-source-${id}`

export async function storeTranscript(owner: string, meetingId: string, source: File, text: string): Promise<void> {
  await putDocumentBlob(owner, transcriptSourceKey(meetingId), source)
  await putDocumentBlob(owner, transcriptTextKey(meetingId), new File([text], `${meetingId}.txt`, { type: 'text/plain' }))
}

export async function readTranscriptText(owner: string, meetingId: string): Promise<string | null> {
  const blob = await getDocumentBlob(owner, transcriptTextKey(meetingId)).catch(() => null)
  return blob ? blob.text() : null
}

export async function readTranscriptSource(owner: string, meetingId: string): Promise<Blob | null> {
  return getDocumentBlob(owner, transcriptSourceKey(meetingId)).catch(() => null)
}

/** Only https recording links are kept. */
export function cleanRecordingUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
