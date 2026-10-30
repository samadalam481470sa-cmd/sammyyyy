import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { calendarOwnerKey } from '@/lib/meetingCalendar'
import {
  CRM_MEETINGS_CHANGED,
  loadCrmMeetings,
  readTranscriptText,
  removeCrmMeeting,
  storeTranscript,
  upsertCrmMeeting,
} from '@/lib/crmMeetings'
import { extractTranscriptText } from '@/lib/transcript'
import { isWorkspaceShared, workspaceAiStatus, workspaceMeetingSummary } from '@/lib/workspaceSync'
import type { CrmMeeting, MeetingSummary } from '@/types/crmMeeting'

export interface SummaryService {
  available: boolean
  provider: string | null
  /** Why summaries are off, in plain words. */
  reason: string | null
}

const NO_SERVER =
  'No AI summary service is connected. This CRM is running without the Newport server, so transcripts are never sent anywhere.'
const NOT_CONFIGURED =
  'No AI summary service is approved on the Newport server yet. An administrator must enable it before transcripts can be summarized.'

/** Team CRM meeting history, plus transcript and summary actions. */
export function useCrmMeetings() {
  const { user } = useAuth()
  const owner = calendarOwnerKey(user)
  const [meetings, setMeetings] = useState<CrmMeeting[]>(() => loadCrmMeetings(owner))
  const [service, setService] = useState<SummaryService>({ available: false, provider: null, reason: null })

  useEffect(() => {
    const sync = () => setMeetings(loadCrmMeetings(owner))
    sync()
    window.addEventListener(CRM_MEETINGS_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CRM_MEETINGS_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [owner])

  const checkService = useCallback(async (): Promise<SummaryService> => {
    if (!isWorkspaceShared()) {
      const next = { available: false, provider: null, reason: NO_SERVER }
      setService(next)
      return next
    }
    try {
      const status = await workspaceAiStatus()
      const next = status.meetingSummary
        ? { available: true, provider: status.provider, reason: null }
        : { available: false, provider: null, reason: NOT_CONFIGURED }
      setService(next)
      return next
    } catch (err) {
      const next = { available: false, provider: null, reason: err instanceof Error ? `The Newport server could not be reached: ${err.message}` : NOT_CONFIGURED }
      setService(next)
      return next
    }
  }, [])

  // Ask the server once the page has rendered (an external system, so this belongs in an effect).
  useEffect(() => {
    const id = window.setTimeout(() => void checkService(), 0)
    return () => window.clearTimeout(id)
  }, [checkService])

  const save = useCallback((meeting: CrmMeeting) => upsertCrmMeeting(owner, meeting), [owner])

  const remove = useCallback((id: string) => removeCrmMeeting(owner, id), [owner])

  /** Summary from the uploaded transcript only. Never fabricated: failures keep the transcript and say why. */
  const summarize = useCallback(
    async (meeting: CrmMeeting): Promise<CrmMeeting> => {
      const text = await readTranscriptText(owner, meeting.id)
      if (!text) {
        return upsertCrmMeeting(owner, { ...meeting, summary: { ...meeting.summary, status: 'error', error: 'The transcript text is missing on this device. Upload it again.' } })
      }
      const svc = await checkService()
      if (!svc.available) {
        return upsertCrmMeeting(owner, { ...meeting, summary: { ...meeting.summary, status: 'unavailable', error: svc.reason ?? NOT_CONFIGURED } })
      }
      upsertCrmMeeting(owner, { ...meeting, summary: { ...meeting.summary, status: 'pending', error: undefined } })
      try {
        const result = await workspaceMeetingSummary(text)
        const summary: MeetingSummary = {
          status: 'ready',
          generatedAt: new Date().toISOString(),
          provider: result.provider,
          discussion: result.summary.discussion,
          decisions: result.summary.decisions,
          openQuestions: result.summary.openQuestions,
          nextSteps: result.summary.nextSteps,
          proposedActions: result.summary.proposedActions.map((row, index) => ({
            id: `pa_${meeting.id}_${index}`,
            action: row.action,
            ownerHint: row.owner ?? undefined,
            createdTaskId: null,
          })),
          ...(result.truncated ? { error: 'The transcript was very long; only the first part was summarized.' } : {}),
        }
        return upsertCrmMeeting(owner, { ...loadCrmMeetings(owner).find((m) => m.id === meeting.id) ?? meeting, summary })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The summary could not be created.'
        const unavailable = /not.*configured|No AI summary/i.test(message)
        return upsertCrmMeeting(owner, { ...meeting, summary: { ...meeting.summary, status: unavailable ? 'unavailable' : 'error', error: message } })
      }
    },
    [owner, checkService],
  )

  /** Extracts and stores the transcript, saves the meeting, then starts the summary automatically. */
  const uploadTranscript = useCallback(
    async (meeting: CrmMeeting, file: File): Promise<CrmMeeting> => {
      const { format, text } = await extractTranscriptText(file)
      await storeTranscript(owner, meeting.id, file, text)
      const saved = upsertCrmMeeting(owner, {
        ...meeting,
        transcript: { fileName: file.name, format, size: file.size, chars: text.length, uploadedAt: new Date().toISOString() },
        summary: { status: 'none', discussion: [], decisions: [], openQuestions: [], nextSteps: [], proposedActions: [] },
      })
      return summarize(saved)
    },
    [owner, summarize],
  )

  return { owner, meetings, service, save, remove, summarize, uploadTranscript, checkService }
}
