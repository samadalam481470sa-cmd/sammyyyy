import { decryptHuddlePayload, encryptHuddlePayload } from '@/lib/huddleCrypto'
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'

export type HuddleWire =
  | { type: 'hello'; from: string; video: boolean }
  | { type: 'bye'; from: string }
  | { type: 'offer'; from: string; to: string; sdp: string }
  | { type: 'answer'; from: string; to: string; sdp: string }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'kick'; from: string; to: string }

export interface HuddleRoom {
  roomId: string
  hostKey: string
  invited: string[]
  video: boolean
  createdAt: string
  expiresAt: string
}

interface EncryptedSignal {
  id: string
  roomId: string
  enc: string
  ts: number
}

const ROOM_STORE = 'huddle_room'
const SIG_STORE = 'huddle_signals'
const CHANNEL = 'newport-huddle-v1'
const SIG_CAP = 80

export function loadHuddleRoom(): HuddleRoom | null {
  const rows = loadDemoCollection<HuddleRoom>(ROOM_STORE, [])
  const room = rows[0]
  if (!room) return null
  if (new Date(room.expiresAt).getTime() < Date.now()) {
    saveDemoCollection(ROOM_STORE, [])
    saveDemoCollection(SIG_STORE, [])
    return null
  }
  return room
}

export function saveHuddleRoom(room: HuddleRoom | null): void {
  saveDemoCollection(ROOM_STORE, room ? [room] : [])
  if (!room) saveDemoCollection(SIG_STORE, [])
}

export function isInvited(room: HuddleRoom | null, ownerKey: string): boolean {
  if (!room) return false
  return room.hostKey === ownerKey || room.invited.includes(ownerKey)
}

type Handler = (msg: HuddleWire) => void

export function subscribeHuddleSignals(roomId: string, onMessage: Handler): () => void {
  const seen = new Set<string>()

  const deliver = async (row: EncryptedSignal) => {
    if (row.roomId !== roomId || seen.has(row.id)) return
    seen.add(row.id)
    const msg = await decryptHuddlePayload<HuddleWire>(roomId, row.enc)
    if (msg) onMessage(msg)
  }

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null
  const onBc = (ev: MessageEvent<EncryptedSignal>) => {
    void deliver(ev.data)
  }
  channel?.addEventListener('message', onBc)

  const onStorage = (ev: StorageEvent) => {
    if (!ev.key || !ev.newValue) return
    if (!ev.key.includes(SIG_STORE) && !ev.key.includes(ROOM_STORE)) return
    const rows = loadDemoCollection<EncryptedSignal>(SIG_STORE, [])
    rows.slice(0, 12).forEach((row) => void deliver(row))
  }
  window.addEventListener('storage', onStorage)

  loadDemoCollection<EncryptedSignal>(SIG_STORE, [])
    .slice(0, 20)
    .forEach((row) => void deliver(row))

  const poll = window.setInterval(() => {
    loadDemoCollection<EncryptedSignal>(SIG_STORE, [])
      .slice(0, 20)
      .forEach((row) => void deliver(row))
  }, 900)

  return () => {
    window.clearInterval(poll)
    window.removeEventListener('storage', onStorage)
    channel?.removeEventListener('message', onBc)
    channel?.close()
  }
}

export async function publishHuddleSignal(roomId: string, msg: HuddleWire): Promise<void> {
  const row: EncryptedSignal = {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    enc: await encryptHuddlePayload(roomId, msg),
    ts: Date.now(),
  }
  const next = [row, ...loadDemoCollection<EncryptedSignal>(SIG_STORE, [])].slice(0, SIG_CAP)
  saveDemoCollection(SIG_STORE, next)
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(row)
    channel.close()
  }
}
