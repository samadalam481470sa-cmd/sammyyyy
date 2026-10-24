import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/types'
import { clearSession, getStoredSession, storeSession } from '@/lib/api'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import { emailOwnerKey } from '@/lib/emailIdentity'
import { TOKEN_KEY, USER_KEY, PROOF_KEY, DEVICE_SECRET_KEY } from '@/lib/sessionProof'

function memoryStorage() {
  const store: Record<string, string> = {}
  const api = {
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
  return api
}

const mary: AuthUser = {
  id: 'mary@outlook.com',
  email: 'mary@outlook.com',
  name: 'Mary',
  role: 'partner',
  initials: 'M',
  authMethod: 'microsoft',
  isManager: false,
  apiKeyId: null,
  apiKeySlot: null,
  apiKeyLabel: null,
}

describe('logout keeps CRM edits', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  it('clears only the session and restores the same email vault', async () => {
    const owner = emailOwnerKey('Mary@Outlook.com')
    saveOwnedCollection('opportunities', owner, [
      { id: 'opp-a', projectName: 'Edited Deal Alpha' },
    ])

    await storeSession('msal', mary, 'email-fingerprint')
    expect(getStoredSession()?.user.email).toBe('mary@outlook.com')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('msal')
    expect(localStorage.getItem(USER_KEY)).toBeTruthy()
    expect(localStorage.getItem(PROOF_KEY)).toBeTruthy()

    clearSession()

    expect(getStoredSession()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(localStorage.getItem(PROOF_KEY)).toBeNull()
    expect(localStorage.getItem(DEVICE_SECRET_KEY)).toBeTruthy()
    expect(loadOwnedCollection('opportunities', owner, [])).toEqual([
      { id: 'opp-a', projectName: 'Edited Deal Alpha' },
    ])
  })

  it('keeps a second email on its own vault', () => {
    saveOwnedCollection('opportunities', emailOwnerKey('a@outlook.com'), [
      { id: 'opp-a', projectName: 'A vault' },
    ])
    saveOwnedCollection('opportunities', emailOwnerKey('b@gmail.com'), [
      { id: 'opp-a', projectName: 'B vault' },
    ])
    expect(loadOwnedCollection('opportunities', emailOwnerKey('a@outlook.com'), [])[0]).toMatchObject(
      { projectName: 'A vault' },
    )
    expect(loadOwnedCollection('opportunities', emailOwnerKey('b@gmail.com'), [])[0]).toMatchObject(
      { projectName: 'B vault' },
    )
  })
})
