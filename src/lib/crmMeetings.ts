/**
 * CRM meeting history is PRIVATE to the signed-in user (sponsor decision, Nov 2026).
 * Records and transcript files are kept in this browser under the user's own account key.
 * They are not sent to the shared workspace and not visible to other users. This is browser-level
 * separation only, not server-side isolation; cross-device sync is a later sprint.
 * Transcript TEXT is sent to the approved AI service only to create a summary, never stored there.
 */
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { deleteDocumentBlob, getDocumentBlob, putDocumentBlob } from '@/lib/documentFileStore'
import type { CrmMeeting } from '@/types/crmMeeting'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { emptySummary } from '@/types/crmMeeting'
import { deleteWorkspaceFile, isWorkspaceShared } from '@/lib/workspaceSync'

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
  // Older builds also copied transcripts to the shared server; remove those copies too.
  if (isWorkspaceShared()) {
    await deleteWorkspaceFile(transcriptTextKey(id)).catch(() => undefined)
    await deleteWorkspaceFile(transcriptSourceKey(id)).catch(() => undefined)
  }
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

/** Saved in this browser's file store under the user's own key. Never uploaded to the shared workspace. */
export async function storeTranscript(owner: string, meetingId: string, source: File, text: string): Promise<void> {
  const textFile = new File([text], `${meetingId}.txt`, { type: 'text/plain' })
  await putDocumentBlob(owner, transcriptSourceKey(meetingId), source)
  await putDocumentBlob(owner, transcriptTextKey(meetingId), textFile)
}

async function readShared(owner: string, key: string): Promise<Blob | null> {
  return getDocumentBlob(owner, key).catch(() => null)
}

export async function readTranscriptText(owner: string, meetingId: string): Promise<string | null> {
  const blob = await readShared(owner, transcriptTextKey(meetingId))
  return blob ? blob.text() : null
}

export async function readTranscriptSource(owner: string, meetingId: string): Promise<Blob | null> {
  return readShared(owner, transcriptSourceKey(meetingId))
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
