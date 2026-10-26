export interface MailMessage {
  id: string
  folder: 'inbox' | 'sent' | 'drafts'
  from: string
  to: string
  subject: string
  preview: string
  body: string
  at: string
  read: boolean
  demo: true
}

const KEY = 'newport_outlook_demo_mailbox_v1'
const SYNC_KEY = 'newport_outlook_last_sync'

const DEMO: MailMessage[] = [
  {
    id: 'demo-mail-1',
    folder: 'inbox',
    from: 'demo.banker@fictional-advisory.test',
    to: 'you@newport.example',
    subject: 'Fictional teaser for Project Q',
    preview: 'Demo mailbox only. This message was not received from Outlook.',
    body: 'This is a fictional demo message. Newport has not connected a live mailbox, so nothing here was sent or received through Microsoft Graph.',
    at: '2026-10-26T14:00:00Z',
    read: false,
    demo: true,
  },
  {
    id: 'demo-mail-2',
    folder: 'sent',
    from: 'you@newport.example',
    to: 'demo.counsel@fictional-law.test',
    subject: 'Demo follow-up',
    preview: 'Not delivered. Shown only so the Sent folder has a sample.',
    body: 'Demo sent item. No email left this browser.',
    at: '2026-10-25T18:30:00Z',
    read: true,
    demo: true,
  },
  {
    id: 'demo-mail-3',
    folder: 'drafts',
    from: 'you@newport.example',
    to: '',
    subject: 'Draft: fictional introduction',
    preview: 'Unsent demo draft.',
    body: 'Finish this only inside the demo mailbox. It is not in Outlook.',
    at: '2026-10-24T12:00:00Z',
    read: true,
    demo: true,
  },
]

export function loadMailbox(): MailMessage[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEMO
    const parsed = JSON.parse(raw) as MailMessage[]
    return Array.isArray(parsed) && parsed.length ? parsed : DEMO
  } catch {
    return DEMO
  }
}

export function saveMailbox(messages: MailMessage[]): void {
  localStorage.setItem(KEY, JSON.stringify(messages))
}

export function lastOutlookSync(): string | null {
  try {
    return localStorage.getItem(SYNC_KEY)
  } catch {
    return null
  }
}

export function markOutlookSynced(): string {
  const at = new Date().toISOString()
  localStorage.setItem(SYNC_KEY, at)
  return at
}

export const OUTLOOK_SYNC_EVENT = 'newport-outlook-sync'

export function requestOutlookSync(): void {
  window.dispatchEvent(new CustomEvent(OUTLOOK_SYNC_EVENT))
}
