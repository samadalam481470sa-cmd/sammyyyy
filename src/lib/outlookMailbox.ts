import { normalizeEmail } from '@/lib/emailIdentity'

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
  demo: boolean
}

function accountEmail(email: string): string {
  return normalizeEmail(email)
}

function mailboxKey(email: string): string {
  return `newport_outlook_mailbox_v1:${accountEmail(email)}`
}

function syncKey(email: string): string {
  return `newport_outlook_last_sync_v1:${accountEmail(email)}`
}

/** Fictional samples used only when this login has no Graph mailbox yet. */
export function demoMailbox(email: string): MailMessage[] {
  const address = accountEmail(email) || 'signed-in@newport.example'
  return [
    {
      id: 'demo-mail-1',
      folder: 'inbox',
      from: 'demo.banker@fictional-advisory.test',
      to: address,
      subject: 'Fictional teaser for Project Q',
      preview: 'Fictional demo. This message was not received from Outlook.',
      body: `This is a fictional demo message addressed to ${address}. Microsoft Graph consent is not available, so nothing here was sent or received through Outlook.`,
      at: '2026-10-26T14:00:00Z',
      read: false,
      demo: true,
    },
    {
      id: 'demo-mail-2',
      folder: 'sent',
      from: address,
      to: 'demo.counsel@fictional-law.test',
      subject: 'Fictional demo follow-up',
      preview: 'Fictional demo. Microsoft did not deliver this.',
      body: `Fictional sent item from ${address}. No email left this browser.`,
      at: '2026-10-25T18:30:00Z',
      read: true,
      demo: true,
    },
    {
      id: 'demo-mail-3',
      folder: 'drafts',
      from: address,
      to: '',
      subject: 'Draft: fictional introduction',
      preview: 'Fictional unsent demo draft.',
      body: `Finish this only inside the fictional demo mailbox for ${address}. It is not in Outlook.`,
      at: '2026-10-24T12:00:00Z',
      read: true,
      demo: true,
    },
  ]
}

export function loadMailbox(email: string): MailMessage[] {
  try {
    const raw = localStorage.getItem(mailboxKey(email))
    if (raw == null) return demoMailbox(email)
    const parsed = JSON.parse(raw) as MailMessage[]
    return Array.isArray(parsed) ? parsed : demoMailbox(email)
  } catch {
    return demoMailbox(email)
  }
}

export function saveMailbox(email: string, messages: MailMessage[]): void {
  localStorage.setItem(mailboxKey(email), JSON.stringify(messages))
}

export function lastOutlookSync(email: string): string | null {
  try {
    return localStorage.getItem(syncKey(email))
  } catch {
    return null
  }
}

export function markOutlookSynced(email: string): string {
  const at = new Date().toISOString()
  localStorage.setItem(syncKey(email), at)
  return at
}

export const OUTLOOK_SYNC_EVENT = 'newport-outlook-sync'

export function requestOutlookSync(): void {
  window.dispatchEvent(new CustomEvent(OUTLOOK_SYNC_EVENT))
}
