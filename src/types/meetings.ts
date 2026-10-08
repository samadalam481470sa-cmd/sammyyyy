export type MeetingChannel =
  | 'teams'
  | 'zoom'
  | 'skype'
  | 'meet'
  | 'webex'
  | 'phone'
  | 'landline'
  | 'facecall'

export type MeetingStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export interface TranscriptLine {
  id: string
  speaker: string
  text: string
  at: string
  interim?: boolean
}

export interface MeetingRecord {
  id: string
  title: string
  channel: MeetingChannel
  status: MeetingStatus
  direction: 'outbound' | 'inbound' | 'conference'
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
  hostName: string
  participantName: string
  participantCompany: string
  participantEmail: string
  participantPhone: string
  joinUrl: string
  dialedNumber: string
  opportunityId: string | null
  projectName: string
  transcript: string
  transcriptLinesJson: string
  summary: string
  customerNotes: string
  tags: string
  recordingEnabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CustomerCapture {
  name: string
  company: string
  title: string
  email: string
  phone: string
  projectName: string
  notes: string
}
