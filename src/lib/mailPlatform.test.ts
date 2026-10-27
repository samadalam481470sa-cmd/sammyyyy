import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachmentProblem, invalidAddresses, withSignature, SIGNATURE_MARK } from './mailCompose'
import { mailDocument } from './mailHtml'
import { mailProvider, mergeMailbox, type MailMessage } from './outlookMailbox'
import { buildRawMessage, decodeBase64Url, gmailChangesSince } from './gmail'

const row = (id: string, folder: MailMessage['folder'], at: string, extra: Partial<MailMessage> = {}): MailMessage => ({
  id, folder, from: 'a@x.com', to: 'b@x.com', subject: id, preview: '', body: '', at, read: true, demo: false, ...extra,
})

describe('combined inbox (guide p57)', () => {
  it('a refresh of one account never removes the other account’s mail', () => {
    const existing = [row('o1', 'inbox', '2026-10-26T13:00:00Z'), row('gmail:g1', 'inbox', '2026-10-26T11:00:00Z')]
    const next = mergeMailbox(existing, { folder: 'inbox', incoming: [row('o2', 'inbox', '2026-10-26T12:00:00Z')], replaceFolder: true, provider: 'outlook' })
    expect(next.map((m) => m.id).sort()).toEqual(['gmail:g1', 'o2'])
    expect(mailProvider({ id: 'gmail:g1' })).toBe('gmail')
    expect(mailProvider({ id: 'AAMkAD' })).toBe('outlook')
  })

  it('a list refresh never overwrites a body that was already loaded', () => {
    const loaded = row('o1', 'inbox', '2026-10-26T10:00:00Z', { body: 'Full body text', bodyLoaded: true })
    const next = mergeMailbox([loaded], { incoming: [row('o1', 'inbox', '2026-10-26T10:00:00Z', { body: 'preview', bodyLoaded: false, read: false })] })
    expect(next[0]).toMatchObject({ body: 'Full body text', read: false })
  })
})

describe('composer checks (guide p65, p67, p71)', () => {
  it('flags bad addresses and header injection', () => {
    expect(invalidAddresses('ada@x.com, bob@y.org')).toEqual([])
    expect(invalidAddresses('ada@x.com, not-an-address')).toEqual(['not-an-address'])
    expect(invalidAddresses('ada@x.com\r\nBcc: evil@x.com')).toHaveLength(1)
    expect(invalidAddresses('Ada Lovelace <ada@x.com>; bob')).toEqual(['bob'])
  })

  it('adds the signature once', () => {
    const once = withSignature('', 'Sam Alam')
    expect(once).toBe(`${SIGNATURE_MARK}Sam Alam`)
    expect(withSignature(once, 'Sam Alam')).toBe(once)
    expect(withSignature('Hi', '')).toBe('Hi')
  })

  it('enforces provider attachment limits', () => {
    const file = (size: number) => ({ name: 'f.pdf', contentType: 'application/pdf', size, base64: '' })
    expect(attachmentProblem([file(1024)], 'outlook')).toBeNull()
    expect(attachmentProblem([file(4 * 1024 * 1024)], 'outlook')).toMatch(/too large/)
    expect(attachmentProblem([file(3 * 1024 * 1024), file(2 * 1024 * 1024)], 'gmail')).toMatch(/together/)
  })
})

describe('safe rendering (guide p82)', () => {
  it('blocks remote images until allowed and never allows scripts', () => {
    const message = { body: '', bodyHtml: '<p>Hi</p><img src="https://track.example/p.gif"><script>alert(1)</script><div style="background:url(https://x.example/a.png)">x</div>' }
    const blocked = mailDocument(message, { showImages: false })
    expect(blocked.blockedImages).toBe(2)
    expect(blocked.html).not.toContain('track.example')
    expect(blocked.html).not.toContain('<script>')
    expect(blocked.html).toContain("img-src data:;")
    const shown = mailDocument(message, { showImages: true })
    expect(shown.html).toContain('track.example')
    expect(shown.html).toContain("default-src 'none'")
  })
})

describe('Gmail attachments and history (guide p49, p54, p67)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds multipart MIME with the file and safe names', () => {
    const raw = decodeBase64Url(
      buildRawMessage({ to: 'ada@x.com', subject: 'LOI', body: 'Attached.', attachments: [{ name: 'l"o\ni.pdf', contentType: 'application/pdf', size: 3, base64: 'QUJD' }] }),
    )
    expect(raw).toContain('Content-Type: multipart/mixed; boundary=')
    expect(raw).toContain('Content-Disposition: attachment; filename="l_o_i.pdf"')
    expect(raw).toContain('QUJD')
  })

  it('collapses history into current state and reports expired history', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    store.set('newport_outlook_gmail_token:sam@x.com', JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 3_600_000, address: 'sam@gmail.com' }))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/history?') && url.includes('startHistoryId=1')) {
        return new Response(JSON.stringify({
          historyId: '9',
          history: [
            { messagesAdded: [{ message: { id: 'm1' } }], labelsRemoved: [{ message: { id: 'm1' } }] },
            { messagesAdded: [{ message: { id: 'm2' } }] },
            { messagesDeleted: [{ message: { id: 'm2' } }] },
          ],
        }))
      }
      if (url.includes('/history?')) return new Response('{}', { status: 404 })
      if (url.includes('/messages/m1')) {
        return new Response(JSON.stringify({ id: 'm1', labelIds: ['INBOX'], internalDate: '1793000000000', payload: { headers: [{ name: 'Subject', value: 'Hello' }] } }))
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const changes = await gmailChangesSince('sam@x.com', '1')
    expect(changes).toMatchObject({ kind: 'changes', historyId: '9', removedIds: ['gmail:m2'] })
    if (changes.kind === 'changes') expect(changes.changed.map((m) => [m.id, m.folder, m.read])).toEqual([['gmail:m1', 'inbox', true]])
    await expect(gmailChangesSince('sam@x.com', '5')).resolves.toEqual({ kind: 'expired' })
  })
})
