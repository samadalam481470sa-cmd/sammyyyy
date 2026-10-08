import { describe, expect, it } from 'vitest'
import { ownedStoreName } from './demoStore'
import { ownerKeyFromAuth, sessionOwnerKey } from './ownerKey'

describe('sessionOwnerKey', () => {
  it('keeps slot keys, manager, and demo isolated', () => {
    expect(sessionOwnerKey({ id: 'user-dennis', authMethod: 'api_key', apiKeySlot: 1 })).toBe(
      'key:slot-1',
    )
    expect(sessionOwnerKey({ id: 'user-dennis', authMethod: 'api_key', apiKeySlot: 2 })).toBe(
      'key:slot-2',
    )
    expect(sessionOwnerKey({ id: 'user-manager', authMethod: 'manager_key', isManager: true })).toBe(
      'key:manager',
    )
    expect(sessionOwnerKey({ id: 'user-dennis', authMethod: 'demo' })).toBe('key:demo')
    expect(ownerKeyFromAuth({ userId: 'user-dennis', apiKeySlot: 3, authMethod: 'api_key' })).toBe(
      'key:slot-3',
    )
  })

  it('stores each key’s CRM collection separately', () => {
    expect(ownedStoreName('opportunities', 'key:slot-1')).toBe('opportunities__key:slot-1')
    expect(ownedStoreName('opportunities', 'key:slot-1')).not.toBe(
      ownedStoreName('opportunities', 'key:manager'),
    )
  })
})
