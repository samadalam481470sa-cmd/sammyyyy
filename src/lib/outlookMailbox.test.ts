import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  demoMailbox,
  filterMailbox,
  lastOutlookSync,
  loadDeltaLinks,
  loadMailbox,
  markOutlookSynced,
  mergeMailbox,
  saveDeltaLink,
  saveMailbox,
  type MailMessage,
} from './outlookMailbox'

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

describe('per-account Outlook mailbox', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('keeps messages and last-sync time on the normalized login email', () => {
    const mary = loadMailbox('Mary@Outlook.com')
    expect(mary.every((message) => message.demo)).toBe(true)
    expect(mary.find((message) => message.folder === 'inbox')?.to).toBe('mary@outlook.com')
    expect(mary.find((message) => message.folder === 'sent')?.from).toBe('mary@outlook.com')
    expect(mary.some((message) => /fictional/i.test(`${message.subject} ${message.preview} ${message.body}`))).toBe(true)

    saveMailbox('Mary@Outlook.com', [
      {
        id: 'mary-only',
        folder: 'inbox',
        from: 'bank@example.com',
        to: 'mary@outlook.com',
        subject: 'Mary only',
        preview: 'private',
        body: 'private',
        at: '2026-10-26T00:00:00Z',
        read: false,
        demo: false,
      },
    ])
    saveMailbox('sam@outlook.com', [])

    expect(loadMailbox('mary@outlook.com').map((message) => message.id)).toEqual(['mary-only'])
    expect(loadMailbox('sam@outlook.com')).toEqual([])
    expect(loadMailbox('sam@outlook.com')).not.toEqual(loadMailbox('MARY@outlook.com'))

    markOutlookSynced('Mary@Outlook.com')
    expect(lastOutlookSync('mary@outlook.com')).toBeTruthy()
    expect(lastOutlookSync('sam@outlook.com')).toBeNull()
    expect(demoMailbox('Sam@Outlook.com')[0]?.to).toBe('sam@outlook.com')
  })

  it('does not read the old shared mailbox key', () => {
    localStorage.setItem(
      'newport_outlook_demo_mailbox_v1',
      JSON.stringify([{ id: 'shared', to: 'someone-else@example.com', demo: false }]),
    )
    expect(loadMailbox('mary@outlook.com').some((message) => message.id === 'shared')).toBe(false)
    expect(loadMailbox('mary@outlook.com')[0]?.to).toBe('mary@outlook.com')
  })

  it('merges by id without duplicates and keeps other folders', () => {
    const row = (id: string, folder: MailMessage['folder'], subject: string, extra: Partial<MailMessage> = {}): MailMessage => ({
      id,
      folder,
      from: 'ada@gmail.com',
      to: 'mary@outlook.com',
      subject,
      preview: 'preview',
      body: extra.body ?? '',
      at: '2026-10-26T12:00:00Z',
      read: false,
      demo: false,
      ...extra,
    })
    const existing = [row('a', 'inbox', 'Hello', { body: 'Kept body', bodyLoaded: true }), row('s', 'sent', 'Sent')]
    const merged = mergeMailbox(existing, {
      folder: 'inbox',
      incoming: [row('a', 'inbox', 'Hello again'), row('b', 'inbox', 'New'), row('a', 'inbox', 'Hello again')],
      replaceFolder: false,
    })
    expect(merged.map((message) => message.id).sort()).toEqual(['a', 'b', 's'])
    expect(merged.find((message) => message.id === 'a')).toMatchObject({ subject: 'Hello again', body: 'Kept body' })

    const replaced = mergeMailbox(merged, {
      folder: 'inbox',
      incoming: [row('b', 'inbox', 'Only b')],
      removedIds: ['missing'],
      replaceFolder: true,
    })
    expect(replaced.map((message) => message.id).sort()).toEqual(['b', 's'])

    const pending = row('pending-1', 'sent', 'Hello', { to: 'ada@gmail.com', pending: true, body: 'Note' })
    const reconciled = mergeMailbox([pending, row('real', 'inbox', 'Other')], {
      folder: 'sent',
      incoming: [row('real-sent', 'sent', 'Hello', { to: 'ada@gmail.com', preview: 'from graph' })],
      replaceFolder: true,
    })
    expect(reconciled.map((message) => message.id).sort()).toEqual(['real', 'real-sent'])
  })

  it('filters the open folder immediately and keeps delta links per account', () => {
    const mary = demoMailbox('mary@outlook.com')
    expect(filterMailbox(mary, 'inbox', 'project q').map((message) => message.id)).toEqual(['demo-mail-1'])
    expect(filterMailbox(mary, 'sent', 'project q')).toEqual([])
    saveDeltaLink('Mary@Outlook.com', 'inbox', 'https://graph.example/mary')
    saveDeltaLink('sam@outlook.com', 'inbox', 'https://graph.example/sam')
    expect(loadDeltaLinks('mary@outlook.com').inbox).toBe('https://graph.example/mary')
    expect(loadDeltaLinks('sam@outlook.com').inbox).toBe('https://graph.example/sam')
    expect(loadDeltaLinks('mary@outlook.com').sent).toBeUndefined()
  })
})
