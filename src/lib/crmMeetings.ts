/**
 * CRM meeting history is PRIVATE to the signed-in user. With the Newport server connected, each
 * record and transcript is stored under the verified Microsoft account (private_meetings), so the
 * person sees it on their other devices and nobody else can read it. This browser keeps a cache
 * under the same person's key. Transcript TEXT goes to the approved AI service only to create a
 * summary and is not stored there.
 */
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { deleteDocumentBlob, getDocumentBlob, putDocumentBlob } from '@/lib/documentFileStore'
import type { CrmMeeting } from '@/types/crmMeeting'
import type { OutlookEvent } from '@/lib/graphCalendar'
import { emptySummary } from '@/types/crmMeeting'
import { deleteWorkspaceFile, downloadPrivateTranscript, isWorkspaceShared, uploadPrivateTranscript } from '@/lib/workspaceSync'

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

/**
 * Saved in this browser under the user's own key, and, with the server connected, in the user's
 * private store. It is never placed in the shared file store.
 */
export async function storeTranscript(owner: string, meetingId: string, source: File, text: string): Promise<void> {
  const textFile = new File([text], `${meetingId}.txt`, { type: 'text/plain' })
  await putDocumentBlob(owner, transcriptSourceKey(meetingId), source)
  await putDocumentBlob(owner, transcriptTextKey(meetingId), textFile)
  if (isWorkspaceShared()) await uploadTranscriptFiles(owner, meetingId)
}

/** Sends this browser's transcript files to the person's private store. False when there are none. */
export async function uploadTranscriptFiles(owner: string, meetingId: string): Promise<boolean> {
  const text = await getDocumentBlob(owner, transcriptTextKey(meetingId)).catch(() => null)
  const source = await getDocumentBlob(owner, transcriptSourceKey(meetingId)).catch(() => null)
  if (!text && !source) return false
  if (text) await uploadPrivateTranscript(meetingId, 'text', text, `${meetingId}.txt`)
  if (source) await uploadPrivateTranscript(meetingId, 'source', source, (source as File).name || `${meetingId}-transcript`)
  return true
}

/** This browser first, then the person's private store, for a meeting saved on another device. */
async function readTranscript(owner: string, meetingId: string, kind: 'text' | 'source'): Promise<Blob | null> {
  const key = kind === 'text' ? transcriptTextKey(meetingId) : transcriptSourceKey(meetingId)
  const cached = await getDocumentBlob(owner, key).catch(() => null)
  if (cached || !isWorkspaceShared()) return cached
  const remote = await downloadPrivateTranscript(meetingId, kind)
  if (remote) await putDocumentBlob(owner, key, new File([remote], kind === 'text' ? `${meetingId}.txt` : `${meetingId}-transcript`, { type: remote.type })).catch(() => undefined)
  return remote
}

export async function readTranscriptText(owner: string, meetingId: string): Promise<string | null> {
  const blob = await readTranscript(owner, meetingId, 'text')
  return blob ? blob.text() : null
}

export async function readTranscriptSource(owner: string, meetingId: string): Promise<Blob | null> {
  return readTranscript(owner, meetingId, 'source')
}

/** Removes this person's cached meetings and transcripts from this browser. The server copy stays. */
export async function clearLocalMeetingCache(owner: string): Promise<void> {
  const rows = loadCrmMeetings(owner)
  saveDemoCollection(collection(owner), [])
  for (const row of rows) {
    await deleteDocumentBlob(owner, transcriptTextKey(row.id)).catch(() => undefined)
    await deleteDocumentBlob(owner, transcriptSourceKey(row.id)).catch(() => undefined)
  }
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
