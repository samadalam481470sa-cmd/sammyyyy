import { describe, expect, it } from 'vitest'
import { buildRawMessage, decodeBase64Url, encodeBase64Url, readGmailBody, toMailMessage } from './gmail'

describe('Gmail messages', () => {
  it('turns Gmail metadata into a CRM mail row with a gmail: id', () => {
    const row = toMailMessage(
      {
        id: 'abc',
        labelIds: ['INBOX', 'UNREAD'],
        snippet: 'Lunch &amp; diligence',
        internalDate: String(Date.UTC(2026, 9, 26, 15)),
        payload: { headers: [
          { name: 'From', value: 'Mary Smith <mary@newport.example>' },
          { name: 'To', value: 'sam@gmail.com' },
          { name: 'Subject', value: 'Project Q call' },
        ] },
      },
      'inbox',
    )
    expect(row).toMatchObject({ id: 'gmail:abc', folder: 'inbox', from: 'mary@newport.example', subject: 'Project Q call', read: false, preview: 'Lunch & diligence' })
    expect(row.at).toBe('2026-10-26T15:00:00.000Z')
  })

  it('reads plain text, HTML, and attachments from a full message', () => {
    const body = readGmailBody({
      id: 'x',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'multipart/alternative', parts: [
            { mimeType: 'text/plain', body: { data: encodeBase64Url('When: Nov 3 at 2pm — café') } },
            { mimeType: 'text/html', body: { data: encodeBase64Url('<p>When: Nov 3</p>') } },
          ] },
          { mimeType: 'application/pdf', filename: 'loi.pdf', body: { attachmentId: 'att1', size: 1200 } },
        ],
      },
    })
    expect(body.body).toBe('When: Nov 3 at 2pm — café')
    expect(body.bodyHtml).toBe('<p>When: Nov 3</p>')
    expect(body.attachments).toEqual([{ id: 'att1', name: 'loi.pdf', contentType: 'application/pdf', size: 1200 }])
  })

  it('builds an RFC 2822 message with UTF-8 subject and reply headers', () => {
    const raw = decodeBase64Url(
      buildRawMessage({ to: 'ada@gmail.com', cc: 'bo@x.com', subject: 'Résumé', body: 'Hi', inReplyTo: '<m1@mail.gmail.com>' }),
    )
    expect(raw).toContain('To: ada@gmail.com\r\n')
    expect(raw).toContain('Cc: bo@x.com\r\n')
    expect(raw).toContain('Subject: =?UTF-8?B?')
    expect(raw).toContain('In-Reply-To: <m1@mail.gmail.com>')
    expect(raw.endsWith('\r\n\r\nHi')).toBe(true)
  })
})

describe('Gmail reconnect', () => {
  it('asks for a reconnect when Gmail was connected before but the token is gone', async () => {
    const store = (): Storage => {
      const rows = new Map<string, string>()
      return {
        getItem: (k: string) => rows.get(k) ?? null,
        setItem: (k: string, v: string) => void rows.set(k, v),
        removeItem: (k: string) => void rows.delete(k),
        clear: () => rows.clear(),
        key: () => null,
        get length() {
          return rows.size
        },
      }
    }
    const g = globalThis as unknown as { localStorage: Storage; sessionStorage: Storage }
    g.localStorage = store()
    g.sessionStorage = store()
    const { gmailNeedsRenewal, rememberedGmail, disconnectGmail } = await import('./gmail')
    expect(gmailNeedsRenewal('sam@utd.edu')).toBe(false)
    g.localStorage.setItem('newport_outlook_gmail_remembered:sam@utd.edu', 'sam@gmail.com')
    expect(rememberedGmail('SAM@utd.edu')).toBe('sam@gmail.com')
    expect(gmailNeedsRenewal('sam@utd.edu')).toBe(true)
    ;(globalThis as unknown as { window: object }).window = {}
    disconnectGmail('sam@utd.edu')
    expect(gmailNeedsRenewal('sam@utd.edu')).toBe(false)
  })
})
