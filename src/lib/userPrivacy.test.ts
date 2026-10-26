import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeOtherUsersMail, purgePersonalData, sameMailbox } from './userPrivacy'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

describe('user privacy on a shared browser', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  it('logout removes mail and sign-in but keeps company data', () => {
    localStorage.setItem('newport_outlook_mailbox_v1:a@x.com', '[]')
    localStorage.setItem('msal.token.keys.abc', '{}')
    sessionStorage.setItem('newport_crm_session_user', '{}')
    localStorage.setItem('newport_crm_demo_v1_opportunities__email:a@x.com', '[1]')
    purgePersonalData()
    expect(localStorage.getItem('newport_outlook_mailbox_v1:a@x.com')).toBeNull()
    expect(localStorage.getItem('msal.token.keys.abc')).toBeNull()
    expect(sessionStorage.getItem('newport_crm_session_user')).toBeNull()
    expect(localStorage.getItem('newport_crm_demo_v1_opportunities__email:a@x.com')).toBe('[1]')
  })

  it('a new login drops the previous user mail only', () => {
    localStorage.setItem('newport_outlook_mailbox_v1:old@x.com', '[]')
    localStorage.setItem('newport_outlook_mailbox_v1:New@X.com', '[]')
    purgeOtherUsersMail('new@x.com')
    expect(localStorage.getItem('newport_outlook_mailbox_v1:old@x.com')).toBeNull()
    expect(localStorage.getItem('newport_outlook_mailbox_v1:New@X.com')).toBe('[]')
  })

  it('matches mailbox to login without case issues', () => {
    expect(sameMailbox('Sam@UTDallas.edu', 'sam@utdallas.edu')).toBe(true)
    expect(sameMailbox('other@utdallas.edu', 'sam@utdallas.edu')).toBe(false)
    expect(sameMailbox('', '')).toBe(false)
  })
})
