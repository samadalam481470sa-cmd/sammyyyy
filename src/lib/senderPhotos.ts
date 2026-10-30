/**
 * Sender photos from Microsoft 365 (Graph /users/{address}/photo). They exist only for people in
 * the signed-in user's organization directory; everyone else keeps initials.
 * Uses the separate delegated permission User.ReadBasic.All, requested only when the user chooses
 * "Show sender photos", so the existing mail sign-in and its permissions are not changed.
 */
import { useEffect, useState } from 'react'
import { getGraphAccessToken } from '@/auth/msal'

export const PHOTO_SCOPES = ['User.ReadBasic.All']
const OPT_IN_KEY = 'newport_crm_sender_photos_on'
const MISS_KEY = 'newport_crm_sender_photos_miss'
const MISS_TTL_MS = 7 * 86_400_000
export const SENDER_PHOTOS_CHANGED = 'newport-sender-photos-changed'

const urls = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

export function senderPhotosEnabled(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === '1'
  } catch {
    return false
  }
}

function readMisses(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(MISS_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function rememberMiss(address: string) {
  try {
    const misses = readMisses()
    misses[address] = Date.now()
    localStorage.setItem(MISS_KEY, JSON.stringify(misses))
  } catch {
    // ignore
  }
}

/** Asks Microsoft for the photo permission (a pop-up the user approves), then turns photos on. */
export async function enableSenderPhotos(): Promise<boolean> {
  const token = await getGraphAccessToken(PHOTO_SCOPES, { interactive: true, mode: 'popup' }).catch(() => null)
  if (!token) return false
  try {
    localStorage.setItem(OPT_IN_KEY, '1')
    localStorage.removeItem(MISS_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(SENDER_PHOTOS_CHANGED))
  return true
}

export function disableSenderPhotos(): void {
  try {
    localStorage.removeItem(OPT_IN_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(SENDER_PHOTOS_CHANGED))
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export async function fetchSenderPhoto(address: string, token: string, fetchImpl: FetchLike = fetch): Promise<Blob | null> {
  const res = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(address)}/photos/48x48/$value`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const blob = await res.blob()
  return blob.type.startsWith('image/') ? blob : null
}

export async function senderPhotoUrl(address: string): Promise<string | null> {
  const key = address.trim().toLowerCase()
  if (!key.includes('@') || !senderPhotosEnabled()) return null
  if (urls.has(key)) return urls.get(key)!
  const miss = readMisses()[key]
  if (miss && Date.now() - miss < MISS_TTL_MS) return null
  if (inflight.has(key)) return inflight.get(key)!
  const job = (async () => {
    const token = await getGraphAccessToken(PHOTO_SCOPES, { interactive: false }).catch(() => null)
    if (!token) return null
    const blob = await fetchSenderPhoto(key, token).catch(() => null)
    if (!blob) {
      rememberMiss(key)
      return null
    }
    const url = URL.createObjectURL(blob)
    urls.set(key, url)
    return url
  })()
  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}

/** Photo URL for a sender, or null to keep initials. */
export function useSenderPhoto(address: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (address ? urls.get(address.trim().toLowerCase()) ?? null : null))
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener(SENDER_PHOTOS_CHANGED, bump)
    return () => window.removeEventListener(SENDER_PHOTOS_CHANGED, bump)
  }, [])
  useEffect(() => {
    let alive = true
    if (!address) return
    void senderPhotoUrl(address).then((next) => {
      if (alive) setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [address, version])
  return address ? url : null
}
