import type { MeetingChannel } from '@/types/meetings'

/** Build deep-links / join URLs for common conference platforms. */
export function buildJoinUrl(
  channel: MeetingChannel,
  opts: { meetingId?: string; phone?: string; title?: string } = {},
): string {
  const id = (opts.meetingId || '').trim()
  const phone = (opts.phone || '').replace(/[^\d+]/g, '')

  switch (channel) {
    case 'teams':
      // Teams deep link — opens desktop/web client with join flow
      if (id.startsWith('http')) return id
      return id
        ? `https://teams.microsoft.com/l/meetup-join/${encodeURIComponent(id)}`
        : 'https://teams.microsoft.com/l/meeting-join'
    case 'zoom':
      if (id.startsWith('http')) return id
      const zoomNum = id.replace(/\D/g, '') || '00000000000'
      return `https://zoom.us/j/${zoomNum}`
    case 'skype':
      if (id.startsWith('http') || id.startsWith('skype:')) return id
      return id ? `skype:${encodeURIComponent(id)}?call` : 'https://web.skype.com/'
    case 'meet':
      if (id.startsWith('http')) return id
      return id
        ? `https://meet.google.com/${id}`
        : 'https://meet.google.com/new'
    case 'webex':
      if (id.startsWith('http')) return id
      return id
        ? `https://webex.com/meet/${encodeURIComponent(id)}`
        : 'https://webex.com/'
    case 'phone':
    case 'landline':
      return phone ? `tel:${phone}` : 'tel:'
    case 'facecall':
      return '#facecall'
    default:
      return '#'
  }
}

export function channelLabel(channel: MeetingChannel): string {
  const map: Record<MeetingChannel, string> = {
    teams: 'Microsoft Teams',
    zoom: 'Zoom',
    skype: 'Skype',
    meet: 'Google Meet',
    webex: 'Webex',
    phone: 'Mobile / Softphone',
    landline: 'Landline',
    facecall: 'Face call (CRM room)',
  }
  return map[channel]
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function normalizePhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw.trim()
}
