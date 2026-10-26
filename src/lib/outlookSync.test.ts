import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emailOwnerKey } from './emailIdentity'
import { loadCalendarEvents, saveCalendarEvents } from './meetingCalendar'
import { loadMailbox, saveMailbox, type MailFolder } from './outlookMailbox'

const {
  outlookToken,
  sendOutlookMail,
  replyOutlookMail,
  replyAllOutlookMail,
  forwardOutlookMail,
  listOutlookFolder,
  listOutlookEvents,
  deltaOutlookFolder,
} = vi.hoisted(() => ({
  outlookToken: vi.fn(),
  sendOutlookMail: vi.fn(),
  replyOutlookMail: vi.fn(),
  replyAllOutlookMail: vi.fn(),
  forwardOutlookMail: vi.fn(),
  listOutlookFolder: vi.fn(),
  listOutlookEvents: vi.fn(),
  deltaOutlookFolder: undefined,
}))

vi.mock('@/lib/outlookGraph', () => ({
  outlookToken,
  sendOutlookMail,
  replyOutlookMail,
  replyAllOutlookMail,
  forwardOutlookMail,
  listOutlookFolder,
  listOutlookEvents,
  deltaOutlookFolder,
}))

import { deliverMail, mailPollDelay, syncOutlookNow, OUTLOOK_BACKGROUND_SYNC_MS } from './outlookSync'

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
    replyAllOutlookMail.mockReset()
    forwardOutlookMail.mockReset()
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

    await expect(
      deliverMail({
        email: 'mary@outlook.com',
        to: 'ada@gmail.com, sam@outlook.com',
        cc: 'cc@gmail.com',
        bcc: 'bcc@company.test',
        subject: 'FYI',
        body: 'See below',
        replyToId: 'AAMk-real',
        action: 'forward',
      }),
    ).resolves.toBe('graph')
    expect(forwardOutlookMail).toHaveBeenCalledWith('graph-token', 'AAMk-real', {
      to: 'ada@gmail.com, sam@outlook.com',
      cc: 'cc@gmail.com',
      bcc: 'bcc@company.test',
      comment: 'See below',
    })
    expect(sendOutlookMail).toHaveBeenCalledTimes(1)

    await expect(
      deliverMail({
        email: 'mary@outlook.com',
        to: 'ada@gmail.com',
        subject: 'Re: Hello',
        body: 'Everyone',
        replyToId: 'AAMk-real',
        action: 'replyAll',
      }),
    ).resolves.toBe('graph')
    expect(replyAllOutlookMail).toHaveBeenCalledWith('graph-token', 'AAMk-real', 'Everyone')
  })

  it('sends to a gmail address through the signed-in mailbox with cc and bcc', async () => {
    outlookToken.mockResolvedValue('graph-token')
    sendOutlookMail.mockResolvedValue(undefined)
    await deliverMail({
      email: 'mary@outlook.com',
      to: 'friend@gmail.com',
      cc: 'cc@outlook.com',
      bcc: 'audit@contoso.com',
      subject: 'Hello',
      body: 'Note',
    })
    expect(sendOutlookMail).toHaveBeenCalledWith('graph-token', {
      to: 'friend@gmail.com',
      cc: 'cc@outlook.com',
      bcc: 'audit@contoso.com',
      subject: 'Hello',
      body: 'Note',
    })
  })

  it('refuses to send when Outlook is not connected and saves nothing', async () => {
    outlookToken.mockResolvedValue(null)
    await expect(
      deliverMail({ email: 'Mary@Outlook.com', to: 'ada@outlook.com', subject: 'Hello', body: 'Note' }),
    ).rejects.toThrow(/not connected/i)
    expect(loadMailbox('mary@outlook.com').some((message) => message.subject === 'Hello')).toBe(false)

    outlookToken.mockResolvedValue('graph-token')
    sendOutlookMail.mockRejectedValue(new Error('consent denied'))
    await expect(
      deliverMail({ email: 'sam@outlook.com', to: 'ada@outlook.com', subject: 'Blocked', body: 'Nope' }),
    ).rejects.toThrow(/consent denied/)
    expect(loadMailbox('sam@outlook.com').some((message) => message.subject === 'Blocked')).toBe(false)
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
    listOutlookFolder.mockImplementation(async (_token: string, folder: MailFolder) => [
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

    expect(loadMailbox('mary@outlook.com').map((message) => message.folder).sort()).toEqual([
      'archive',
      'deleted',
      'drafts',
      'inbox',
      'junk',
      'sent',
    ])
    expect(loadMailbox('sam@outlook.com').every((message) => message.demo)).toBe(true)
    expect(loadCalendarEvents(maryOwner).map((event) => event.id).sort()).toEqual(['graph-evt', 'local-mary'])
    expect(loadCalendarEvents(samOwner).map((event) => event.id)).toEqual(['local-sam'])
    expect(localStorage.getItem('crm-form-draft')).toBe('unsaved opportunity')
    expect(reload).not.toHaveBeenCalled()
  })

  it('keeps saved mail on screen when Graph fails and does not duplicate ids', async () => {
    saveMailbox('mary@outlook.com', [
      {
        id: 'kept',
        folder: 'inbox',
        from: 'bank@example.com',
        to: 'mary@outlook.com',
        subject: 'Kept',
        preview: 'still here',
        body: 'still here',
        at: '2026-10-26T12:00:00Z',
        read: true,
        demo: false,
      },
    ])
    outlookToken.mockResolvedValue('graph-token')
    listOutlookFolder.mockRejectedValue(new Error('Outlook inbox failed (403).'))
    await expect(syncOutlookNow('Mary@Outlook.com')).resolves.toBe('demo')
    expect(loadMailbox('mary@outlook.com').map((message) => message.id)).toEqual(['kept'])
    expect(loadMailbox('sam@outlook.com').every((message) => message.demo)).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('polls quickly only while the mailbox is visible', () => {
    expect(mailPollDelay(true)).toBe(12_000)
    expect(mailPollDelay(false)).toBeNull()
    expect(OUTLOOK_BACKGROUND_SYNC_MS).toBeGreaterThanOrEqual(20_000)
    expect(OUTLOOK_BACKGROUND_SYNC_MS).toBeLessThanOrEqual(45_000)
  })
})
