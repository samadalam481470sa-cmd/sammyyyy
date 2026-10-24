import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertLoginAllowed, recordLoginFailure, recordLoginSuccess } from './loginThrottle'

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
  }
}

describe('login throttle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('locks after eight failed attempts and clears on success', () => {
    for (let i = 0; i < 8; i++) recordLoginFailure()
    const locked = assertLoginAllowed()
    expect(locked.ok).toBe(false)
    recordLoginSuccess()
    expect(assertLoginAllowed()).toEqual({ ok: true })
  })
})
