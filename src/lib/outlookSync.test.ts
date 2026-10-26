import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emailOwnerKey } from './emailIdentity'
import { loadCalendarEvents, saveCalendarEvents } from './meetingCalendar'
import { loadMailbox } from './outlookMailbox'

const { outlookToken, sendOutlookMail, replyOutlookMail, listOutlookFolder, listOutlookEvents } = vi.hoisted(() => ({
  outlookToken: vi.fn(),
  sendOutlookMail: vi.fn(),
  replyOutlookMail: vi.fn(),
  listOutlookFolder: vi.fn(),
  listOutlookEvents: vi.fn(),
}))

vi.mock('@/lib/outlookGraph', () => ({
  outlookToken,
  sendOutlookMail,
  replyOutlookMail,
  listOutlookFolder,
  listOutlookEvents,
}))

import { deliverMail, syncOutlookNow } from './outlookSync'

function memoryStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('Outlook send and sync', () => {
  const reload = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { reload },
    })
    reload.mockReset()
    outlookToken.mockReset()
    sendOutlookMail.mockReset()
    replyOutlookMail.mockReset()
    listOutlookFolder.mockReset()
    listOutlookEvents.mockReset()
  })

  it('sends and replies through Graph as the signed-in mailbox', async () => {
    outlookToken.mockResolvedValue('graph-token')
    sendOutlookMail.mockResolvedValue(undefined)
    replyOutlookMail.mockResolvedValue(undefined)

    await expect(
      deliverMail({
        email: 'Mary@Outlook.com',
        to: 'ada@outlook.com',
        subject: 'Hello',
        body: 'Note',
      }),
    ).resolves.toBe('graph')
    expect(sendOutlookMail).toHaveBeenCalledWith('graph-token', {
      to: 'ada@outlook.com',
      subject: 'Hello',
      body: 'Note',
    })

    await expect(
      deliverMail({
        email: 'mary@outlook.com',
        to: 'ada@outlook.com',
        subject: 'Re: Hello',
        body: 'Reply',
        replyToId: 'AAMk-real',
      }),
    ).resolves.toBe('graph')
    expect(replyOutlookMail).toHaveBeenCalledWith('graph-token', 'AAMk-real', 'Reply')
  })

  it('keeps an undelivered message in that login’s fictional Sent folder', async () => {
    outlookToken.mockResolvedValue(null)
    const mode = await deliverMail({
      email: 'Mary@Outlook.com',
      to: 'ada@outlook.com',
      subject: 'Hello',
      body: 'Note',
    })
    expect(mode).toBe('demo')
    const sent = loadMailbox('mary@outlook.com').find((message) => message.subject === 'Hello')
    expect(sent).toMatchObject({
      folder: 'sent',
      from: 'mary@outlook.com',
      demo: true,
    })
    expect(sent?.preview).toMatch(/Microsoft did not deliver/i)
    expect(loadMailbox('sam@outlook.com').some((message) => message.subject === 'Hello')).toBe(false)

    outlookToken.mockResolvedValue('graph-token')
    sendOutlookMail.mockRejectedValue(new Error('consent denied'))
    await deliverMail({
      email: 'sam@outlook.com',
      to: 'ada@outlook.com',
      subject: 'Blocked',
      body: 'Nope',
    })
    const blocked = loadMailbox('sam@outlook.com').find((message) => message.subject === 'Blocked')
    expect(blocked?.from).toBe('sam@outlook.com')
    expect(blocked?.demo).toBe(true)
    expect(loadMailbox('mary@outlook.com').some((message) => message.subject === 'Blocked')).toBe(false)
  })

  it('refreshes only that user’s calendar and does not reload the page', async () => {
    const maryOwner = emailOwnerKey('mary@outlook.com')
    const samOwner = emailOwnerKey('sam@outlook.com')
    saveCalendarEvents(maryOwner, [
      { id: 'local-mary', date: '2026-10-26', time: '10:00', title: 'Mary local', notes: '', remind: true },
    ])
    saveCalendarEvents(samOwner, [
      { id: 'local-sam', date: '2026-10-26', time: '09:00', title: 'Sam local', notes: '', remind: true },
    ])
    localStorage.setItem('crm-form-draft', 'unsaved opportunity')
    outlookToken.mockResolvedValue('graph-token')
    listOutlookFolder.mockImplementation(async (_token: string, folder: 'inbox' | 'sent' | 'drafts') => [
      {
        id: `${folder}-1`,
        folder,
        from: 'bank@example.com',
        to: 'mary@outlook.com',
        subject: folder,
        preview: '',
        body: '',
        at: '2026-10-26T12:00:00Z',
        read: true,
        demo: false,
      },
    ])
    listOutlookEvents.mockResolvedValue([
      { id: 'graph-evt', date: '2026-10-27', time: '11:00', title: 'Graph', notes: '', remind: true },
    ])

    await expect(syncOutlookNow('Mary@Outlook.com')).resolves.toBe('graph')

    expect(loadMailbox('mary@outlook.com').map((message) => message.folder).sort()).toEqual(['drafts', 'inbox', 'sent'])
    expect(loadMailbox('sam@outlook.com').every((message) => message.demo)).toBe(true)
    expect(loadCalendarEvents(maryOwner).map((event) => event.id).sort()).toEqual(['graph-evt', 'local-mary'])
    expect(loadCalendarEvents(samOwner).map((event) => event.id)).toEqual(['local-sam'])
    expect(localStorage.getItem('crm-form-draft')).toBe('unsaved opportunity')
    expect(reload).not.toHaveBeenCalled()
  })
})
