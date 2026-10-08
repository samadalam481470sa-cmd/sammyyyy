import { describe, expect, it } from 'vitest'
import { decryptHuddlePayload, encryptHuddlePayload, newHuddleRoomId } from '@/lib/huddleCrypto'

describe('huddleCrypto', () => {
  it('round-trips AES-GCM payloads for a room', async () => {
    const roomId = newHuddleRoomId()
    const blob = await encryptHuddlePayload(roomId, { type: 'hello', from: 'key:slot-1' })
    const out = await decryptHuddlePayload<{ type: string; from: string }>(roomId, blob)
    expect(out).toEqual({ type: 'hello', from: 'key:slot-1' })
  })

  it('fails to decrypt with a different room id', async () => {
    const blob = await encryptHuddlePayload(newHuddleRoomId(), { secret: true })
    const out = await decryptHuddlePayload(newHuddleRoomId(), blob)
    expect(out).toBeNull()
  })
})
