import {
  isAllowedHttpsJoinUrl,
  isAllowedJoinUrl,
  isDangerousJoinInput,
  sanitizePhone,
} from '@/lib/meetingSecurity'
import type { MeetingChannel } from '@/types/meetings'

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('//')
}

/** Build deep-links / join URLs for common conference platforms. Never pass through untrusted URLs. */
export function buildJoinUrl(
  channel: MeetingChannel,
  opts: { meetingId?: string; phone?: string; title?: string } = {},
): string {
  const rawId = (opts.meetingId || '').trim()
  const id = isDangerousJoinInput(rawId) ? '' : rawId
  const phone = sanitizePhone(opts.phone || '').replace(/[^\d+]/g, '')

  switch (channel) {
    case 'teams':
      if (looksLikeUrl(id)) {
        return isAllowedHttpsJoinUrl(id, 'teams') ? id : 'https://teams.microsoft.com/l/meeting-join'
      }
      return id
        ? `https://teams.microsoft.com/l/meetup-join/${encodeURIComponent(id)}`
        : 'https://teams.microsoft.com/l/meeting-join'
    case 'zoom':
      if (looksLikeUrl(id)) {
        return isAllowedHttpsJoinUrl(id, 'zoom') ? id : 'https://zoom.us/join'
      }
      {
        const zoomNum = id.replace(/\D/g, '')
        return zoomNum ? `https://zoom.us/j/${zoomNum}` : 'https://zoom.us/join'
      }
    case 'skype':
      if (id.startsWith('skype:') && isAllowedJoinUrl(id, 'skype')) return id
      if (looksLikeUrl(id)) {
        return isAllowedHttpsJoinUrl(id, 'skype') ? id : 'https://web.skype.com/'
      }
      return id ? `skype:${encodeURIComponent(id.replace(/[^a-zA-Z0-9._-]/g, ''))}?call` : 'https://web.skype.com/'
    case 'meet':
      if (looksLikeUrl(id)) {
        return isAllowedHttpsJoinUrl(id, 'meet') ? id : 'https://meet.google.com/new'
      }
      return id
        ? `https://meet.google.com/${encodeURIComponent(id.replace(/[^a-zA-Z0-9-]/g, ''))}`
        : 'https://meet.google.com/new'
    case 'webex':
      if (looksLikeUrl(id)) {
        return isAllowedHttpsJoinUrl(id, 'webex') ? id : 'https://webex.com/'
      }
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
  const digits = sanitizePhone(raw).replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return sanitizePhone(raw)
}
