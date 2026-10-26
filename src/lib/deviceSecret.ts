import { randomHex } from '@/lib/sha256'

/** Per-browser secret used to sign session proofs. Never cleared on logout. */
export const DEVICE_SECRET_KEY = 'newport_crm_device_secret_v1'

export function readDeviceSecret(): string {
  try {
    const existing = localStorage.getItem(DEVICE_SECRET_KEY)
    if (existing && existing.length >= 32) return existing
    const next = randomHex(32)
    localStorage.setItem(DEVICE_SECRET_KEY, next)
    return next
  } catch {
    return 'unwritable-device'
  }
}
