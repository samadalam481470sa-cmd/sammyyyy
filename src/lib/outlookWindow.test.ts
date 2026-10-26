import { describe, expect, it, vi } from 'vitest'
import {
  MICROSOFT_CONSUMER_TENANT,
  configuredGoogleClientId,
  openOutlookMailWindow,
  outlookWebUrl,
} from './outlookWindow'

describe('Outlook window', () => {
  it('opens live Outlook for personal accounts and office Outlook otherwise', () => {
    expect(outlookWebUrl('Ada@Outlook.com')).toBe('https://outlook.live.com/mail/')
    expect(outlookWebUrl('ada@contoso.com')).toBe('https://outlook.office.com/mail/')
    expect(outlookWebUrl('ada@contoso.com', MICROSOFT_CONSUMER_TENANT)).toBe('https://outlook.live.com/mail/')
    expect(outlookWebUrl('ada@gmail.com')).toBe('https://outlook.office.com/mail/')
  })

  it('focuses an open window and reports a blocked popup', () => {
    const child = { closed: false, focus: vi.fn(), opener: { location: '/' } }
    const open = vi.fn(() => child)
    vi.stubGlobal('window', { open })
    expect(openOutlookMailWindow('ada@contoso.com')).toBe('opened')
    expect(open).toHaveBeenCalledWith('https://outlook.office.com/mail/', 'newport-outlook-mail', expect.any(String))
    expect(child.opener).toBeNull()
    expect(openOutlookMailWindow('ada@contoso.com')).toBe('focused')
    child.closed = true
    open.mockReturnValueOnce(null as unknown as typeof child)
    expect(openOutlookMailWindow('ada@contoso.com')).toBe('blocked')
  })

  it('does not invent a Google client id', () => {
    expect(configuredGoogleClientId()).toBe('')
    expect(configuredGoogleClientId('  public-client  ')).toBe('public-client')
  })
})