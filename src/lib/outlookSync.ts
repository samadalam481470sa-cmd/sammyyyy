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

export async function syncOutlookNow(owner: string): Promise<string> {
  const token = await outlookToken()
  if (!token) {
    markOutlookSynced()
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: 'Outlook is not connected. The mailbox on screen is fictional. Nothing was sent or received.' }))
    return 'demo'
  }
  try {
    const [inbox, sent, drafts, events] = await Promise.all([
      listOutlookFolder(token, 'inbox'),
      listOutlookFolder(token, 'sent'),
      listOutlookFolder(token, 'drafts'),
      listOutlookEvents(token),
    ])
    saveMailbox([...inbox, ...sent, ...drafts])
    const local = loadCalendarEvents(owner).filter((event) => !event.id.startsWith('graph-'))
    const merged = [...local, ...events.filter((event) => !local.some((row) => row.id === event.id))]
    saveCalendarEvents(owner, merged)
    markOutlookSynced()
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: 'Inbox, Sent, Drafts, and calendar loaded from Microsoft Graph.' }))
    window.dispatchEvent(new CustomEvent('newport-calendar-updated'))
    return 'graph'
  } catch (err) {
    markOutlookSynced()
    const message = err instanceof Error ? err.message : 'Outlook sync failed.'
    window.dispatchEvent(new CustomEvent(OUTLOOK_SYNCED_EVENT, { detail: `${message} Showing the fictional demo mailbox. Nothing was sent.` }))
    return 'demo'
  }
}

export async function deliverMail(input: { to: string; subject: string; body: string; replyToId?: string }): Promise<'graph' | 'demo'> {
  const token = await outlookToken()
  if (token && input.replyToId && !input.replyToId.startsWith('demo-')) {
    await replyOutlookMail(token, input.replyToId, input.body)
    return 'graph'
  }
  if (token && input.to.includes('@')) {
    await sendOutlookMail(token, input)
    return 'graph'
  }
  const message: MailMessage = {
    id: `demo-local-${Date.now()}`,
    folder: 'sent',
    from: 'you@newport.example',
    to: input.to,
    subject: input.subject || '(no subject)',
    preview: 'Demo only. Microsoft did not deliver this.',
    body: `${input.body}\n\nThis stayed in the fictional demo mailbox.`,
    at: new Date().toISOString(),
    read: true,
    demo: true,
  }
  saveMailbox([message, ...loadMailbox()])
  return 'demo'
}

export function installOutlookSync(owner: string): () => void {
  const run = () => {
    void syncOutlookNow(owner)
  }
  window.addEventListener(OUTLOOK_SYNC_EVENT, run)
  return () => window.removeEventListener(OUTLOOK_SYNC_EVENT, run)
}

export function graphCalendarIds(events: CalendarEvent[]): string[] {
  return events.filter((event) => event.id.startsWith('graph-')).map((event) => event.id)
}
