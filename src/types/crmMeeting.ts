import type { CalendarAttendee, CalendarPerson, MeetingPlatform } from '@/lib/graphCalendar'

export interface MeetingTranscriptMeta {
  fileName: string
  /** txt, vtt or docx */
  format: 'txt' | 'vtt' | 'docx'
  size: number
  chars: number
  uploadedAt: string
}

export interface ProposedAction {
  id: string
  action: string
  ownerHint?: string
  /** Set after a task is saved from this proposal. */
  createdTaskId?: string | null
}

export type SummaryStatus = 'none' | 'pending' | 'ready' | 'unavailable' | 'error'

export interface MeetingSummary {
  status: SummaryStatus
  generatedAt?: string
  /** Name of the configured service that produced it, e.g. "OpenAI gpt-4o-mini (admin-configured)". */
  provider?: string
  discussion: string[]
  decisions: string[]
  openQuestions: string[]
  nextSteps: string[]
  proposedActions: ProposedAction[]
  error?: string
}

/**
 * CRM meeting record. Private to the signed-in user (kept on this device only for now).
 * The Outlook event itself is never renamed or deleted from here.
 */
export interface CrmMeeting {
  id: string
  /** Outlook event this record describes. Null for CRM-only meetings (no invite was sent). */
  outlookEventId: string | null
  /** Subject as it appears in Outlook. */
  outlookSubject: string
  /** CRM-only display title. Empty means use the Outlook subject. */
  displayTitle: string
  start: string
  end: string
  location: string
  organizer: CalendarPerson | null
  attendees: CalendarAttendee[]
  platform: MeetingPlatform | null
  joinUrl: string
  opportunityId: string | null
  contactIds: string[]
  primaryContactId: string | null
  transcript: MeetingTranscriptMeta | null
  summary: MeetingSummary
  /** External recording link (https). Recordings are never uploaded. */
  recordingUrl: string
  notes: string
  createdAt: string
  updatedAt: string
}

export function meetingTitle(m: Pick<CrmMeeting, 'displayTitle' | 'outlookSubject'>): string {
  return m.displayTitle.trim() || m.outlookSubject.trim() || 'Untitled meeting'
}

export function emptySummary(): MeetingSummary {
  return { status: 'none', discussion: [], decisions: [], openQuestions: [], nextSteps: [], proposedActions: [] }
}
