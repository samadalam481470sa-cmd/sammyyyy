import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/types'
import { SLOT1_KEY_HASH } from '@/lib/credentialHashes'
import {
  createSessionProof,
  persistProof,
  verifySessionProof,
} from '@/lib/sessionProof'

const slot1: AuthUser = {
  id: 'user-dennis',
  email: 'dennis@newportspecialty.demo',
  name: 'Dennis DiCapua',
  role: 'partner',
  initials: 'DD',
  authMethod: 'api_key',
  isManager: false,
  apiKeySlot: 1,
}

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

describe('sessionProof', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  it('accepts a proof issued for slot 1', async () => {
    const proof = await createSessionProof({
      token: 'local-demo',
      user: slot1,
      fingerprint: SLOT1_KEY_HASH,
    })
    persistProof(proof)
    expect(await verifySessionProof('local-demo', slot1, proof)).toBe(true)
  })

  it('rejects flipping isManager on a partner session', async () => {
    const proof = await createSessionProof({
      token: 'local-demo',
      user: slot1,
      fingerprint: SLOT1_KEY_HASH,
    })
    const escalated = { ...slot1, isManager: true, role: 'admin', authMethod: 'manager_key' as const }
    expect(await verifySessionProof('local-demo', escalated, proof)).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const proof = await createSessionProof({
      token: 'local-demo',
      user: slot1,
      fingerprint: SLOT1_KEY_HASH,
    })
    proof.sig = 'a'.repeat(64)
    expect(await verifySessionProof('local-demo', slot1, proof)).toBe(false)
  })
})
