import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { parseTranscriptLines, sanitizeMeetingRecord } from '@/lib/meetingSecurity'
import type { CustomerCapture, MeetingRecord, TranscriptLine } from '@/types/meetings'

export interface LiveMeetingDraft {
  meetingId: string
  ownerKey: string
  title: string
  channel: MeetingRecord['channel']
  joinId: string
  dialNumber: string
  customer: CustomerCapture
  projectName: string
  opportunityId: string
  lines: TranscriptLine[]
  summary: string
  elapsed: number
  startedAt: string | null
  joinUrl: string
  savedAt: string
}

function meetingsCollection(ownerKey: string) {
  return `meetings_v2_${ownerKey}`
}

function liveDraftKey(ownerKey: string) {
  return `live_meeting_${ownerKey}`
}

export function loadOwnedMeetings(ownerKey: string, fallback: MeetingRecord[] = []): MeetingRecord[] {
  const rows = loadDemoCollection<MeetingRecord>(meetingsCollection(ownerKey), fallback)
  return rows.map((row) => ({ ...row, ...sanitizeMeetingRecord(row), id: row.id }))
}

export function saveOwnedMeetings(ownerKey: string, items: MeetingRecord[]): void {
  saveDemoCollection(meetingsCollection(ownerKey), items)
}

export function loadLiveMeetingDraft(ownerKey: string): LiveMeetingDraft | null {
  const rows = loadDemoCollection<LiveMeetingDraft>(liveDraftKey(ownerKey), [])
  const draft = rows[0]
  if (!draft?.meetingId || draft.ownerKey !== ownerKey) return null
  return {
    ...draft,
    lines: parseTranscriptLines(draft.lines),
    customer: {
      name: draft.customer?.name ?? '',
      company: draft.customer?.company ?? '',
      title: draft.customer?.title ?? '',
      email: draft.customer?.email ?? '',
      phone: draft.customer?.phone ?? '',
      projectName: draft.customer?.projectName ?? '',
      notes: draft.customer?.notes ?? '',
    },
  }
}

export function saveLiveMeetingDraft(ownerKey: string, draft: LiveMeetingDraft): void {
  saveDemoCollection(liveDraftKey(ownerKey), [{ ...draft, ownerKey, savedAt: new Date().toISOString() }])
}

export function clearLiveMeetingDraft(ownerKey: string): void {
  saveDemoCollection(liveDraftKey(ownerKey), [])
}
