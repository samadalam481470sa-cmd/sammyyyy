import { emailOwnerKey, normalizeEmail } from '@/lib/emailIdentity'
import { listOutlookEvents, listOutlookFolder, outlookToken, replyOutlookMail, sendOutlookMail } from '@/lib/outlookGraph'
import { loadCalendarEvents, saveCalendarEvents, type CalendarEvent } from '@/lib/meetingCalendar'
import {
  OUTLOOK_SYNC_EVENT,
  loadMailbox,
  markOutlookSynced,
  saveMailbox,
  type MailMessage,
} from '@/lib/outlookMailbox'

export const OUTLOOK_SYNCED_EVENT = 'newport-outlook-synced'

function accountEmail(email: string): string {
  return normalizeEmail(email)
}

function keepUndelivered(email: string, input: { to: string; subject: string; body: string }): 'demo' {
  const account = accountEmail(email)
  const message: MailMessage = {
    id: `demo-local-${Date.now()}`,
    folder: 'sent',
    from: account,
    to: input.to,
    subject: input.subject || '(no subject)',
    preview: 'Fictional demo. Microsoft did not deliver this.',
    body: `${input.body}\n\nFictional demo only. Microsoft did not deliver this message.`,
    at: new Date().toISOString(),
    read: true,
    demo: true,
  }
  saveMailbox(account, [message, ...loadMailbox(account)])
  return 'demo'
}

export async function syncOutlookNow(email: string): Promise<string> {
  const account = accountEmail(email)
  const token = await outlookToken()
  if (!token) {
    markOutlookSynced(account)
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: `Outlook is not connected for ${account}. The mailbox on screen is fictional. Nothing was sent or received.` }))
    return 'demo'
  }
  try {
    const [inbox, sent, drafts, events] = await Promise.all([
      listOutlookFolder(token, 'inbox'),
      listOutlookFolder(token, 'sent'),
      listOutlookFolder(token, 'drafts'),
      listOutlookEvents(token),
    ])
    saveMailbox(account, [...inbox, ...sent, ...drafts])
    const owner = emailOwnerKey(account)
    const local = loadCalendarEvents(owner).filter((event) => !event.id.startsWith('graph-'))
    const merged = [...local, ...events.filter((event) => !local.some((row) => row.id === event.id))]
    saveCalendarEvents(owner, merged)
    markOutlookSynced(account)
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: `Inbox, Sent, Drafts, and calendar loaded from Microsoft Graph for ${account}.` }))
    window.dispatchEvent(new CustomEvent('newport-calendar-updated'))
    return 'graph'
  } catch (err) {
    markOutlookSynced(account)
    const message = err instanceof Error ? err.message : 'Outlook sync failed.'
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: `${message} Showing the fictional demo mailbox for ${account}. Nothing was sent.` }))
    return 'demo'
  }
}

export async function deliverMail(input: {
  email: string
  to: string
  subject: string
  body: string
  replyToId?: string
  /** Replies to fictional samples stay in that login's demo Sent folder. */
  skipGraph?: boolean
}): Promise<'graph' | 'demo'> {
  const account = accountEmail(input.email)
  if (!input.skipGraph) {
    const token = await outlookToken()
    if (token && input.replyToId && !input.replyToId.startsWith('demo-')) {
      try {
        await replyOutlookMail(token, input.replyToId, input.body)
        return 'graph'
      } catch {
        return keepUndelivered(account, input)
      }
    }
    if (token && input.to.includes('@')) {
      try {
        await sendOutlookMail(token, { to: input.to, subject: input.subject, body: input.body })
        return 'graph'
      } catch {
        return keepUndelivered(account, input)
      }
    }
  }
  return keepUndelivered(account, input)
}

export function installOutlookSync(email: string): () => void {
  const account = accountEmail(email)
  const run = () => {
    void syncOutlookNow(account)
  }
  window.addEventListener(OUTLOOK_SYNC_EVENT, run)
  const timer = window.setInterval(run, 20_000)
  return () => {
    window.removeEventListener(OUTLOOK_SYNC_EVENT, run)
    window.clearInterval(timer)
  }
}

export function graphCalendarIds(events: CalendarEvent[]): string[] {
  return events.filter((event) => event.id.startsWith('graph-')).map((event) => event.id)
}
