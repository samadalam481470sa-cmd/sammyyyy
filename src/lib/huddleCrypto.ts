import { bytesToHex, hexToBytes, sha256Hex } from '@/lib/sha256'

const ROOM_INFO = new TextEncoder().encode('newport-huddle-v1')

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function importAesKey(roomId: string): Promise<CryptoKey> {
  const material = await sha256Hex(`huddle-room|${roomId}|v1`)
  const raw = hexToBytes(material)
  return crypto.subtle.importKey('raw', toBuffer(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptHuddlePayload(roomId: string, data: unknown): Promise<string> {
  const key = await importAesKey(roomId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ROOM_INFO }, key, encoded)
  return `${bytesToHex(iv)}.${bytesToHex(cipher)}`
}

export async function decryptHuddlePayload<T>(roomId: string, blob: string): Promise<T | null> {
  try {
    const [ivHex, dataHex] = blob.split('.')
    if (!ivHex || !dataHex) return null
    const key = await importAesKey(roomId)
    const iv = hexToBytes(ivHex)
    const data = hexToBytes(dataHex)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBuffer(iv), additionalData: ROOM_INFO },
      key,
      toBuffer(data),
    )
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}

export function newHuddleRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return bytesToHex(bytes)
}
