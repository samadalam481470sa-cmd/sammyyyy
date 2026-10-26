import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  demoMailbox,
  lastOutlookSync,
  loadMailbox,
  markOutlookSynced,
  saveMailbox,
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
})
