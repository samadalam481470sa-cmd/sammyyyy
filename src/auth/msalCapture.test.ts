import { afterEach, describe, expect, it, vi } from 'vitest'

/** Minimal browser window: enough for msal.ts to run its startup capture. */
function fakeWindow(href: string, extra: { opener?: unknown; name?: string } = {}) {
  const url = new URL(href)
  const win: Record<string, unknown> = {
    location: {
      get href() {
        return url.toString()
      },
      get hash() {
        return url.hash
      },
      get pathname() {
        return url.pathname
      },
      get search() {
        return url.search
      },
    },
    opener: extra.opener ?? null,
    name: extra.name ?? '',
    history: {
      state: null,
      replaceState: (_state: unknown, _title: string, next: string) => {
        const target = new URL(next, url)
        url.pathname = target.pathname
        url.search = target.search
        url.hash = target.hash
      },
    },
  }
  win.self = win
  win.top = win
  return { win, url }
}

async function loadMsal(win: Record<string, unknown>) {
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { title: 'Newport' })
  vi.resetModules()
  return import('./msal')
}

describe('Microsoft sign-in return at startup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('takes #code=… out of the address before the router can erase it', async () => {
    const { win, url } = fakeWindow('https://samadalam481470sa-cmd.github.io/sammyyyy/#code=abc&client_info=x&state=s1')
    const msal = await loadMsal(win)
    expect(url.hash).toBe('')
    expect(msal.hasEntraRedirectReturn()).toBe(true)
  })

  it('leaves the Connect Outlook popup address alone for the main window to read', async () => {
    const { win, url } = fakeWindow('https://samadalam481470sa-cmd.github.io/sammyyyy/#code=abc&state=s1', {
      opener: {},
      name: 'msal.2e296364.popup',
    })
    const msal = await loadMsal(win)
    expect(msal.isMsalChildWindow()).toBe(true)
    expect(url.hash).toBe('#code=abc&state=s1')
  })

  it('leaves normal CRM page addresses alone', async () => {
    const { win, url } = fakeWindow('https://samadalam481470sa-cmd.github.io/sammyyyy/#/email')
    const msal = await loadMsal(win)
    expect(url.hash).toBe('#/email')
    expect(msal.hasEntraRedirectReturn()).toBe(false)
    expect(msal.isMsalChildWindow()).toBe(false)
  })
})
