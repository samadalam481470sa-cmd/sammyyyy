import { getStoredSession } from '@/lib/api'

/** Static GitHub Pages / CDN demo writes localStorage, not a shared database. */
export function isLocalPersistence(): boolean {
  try {
    return getStoredSession()?.token === 'local-demo'
  } catch {
    return true
  }
}

export function saveButtonLabel(saving: boolean): string {
  if (saving) return 'Saving…'
  return isLocalPersistence() ? 'Save changes' : 'Save changes to database'
}

export function savedMessageLabel(): string {
  return isLocalPersistence() ? 'Saved in this browser' : 'Saved to database'
}
