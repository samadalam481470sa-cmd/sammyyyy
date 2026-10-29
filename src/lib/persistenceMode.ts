import { getStoredSession } from '@/lib/api'
import { isWorkspaceShared } from '@/lib/workspaceSync'

/**
 * Static GitHub Pages / CDN demo writes localStorage, not a shared database.
 * Chrome and Safari (and different profiles) each keep a separate copy.
 * Cross-browser sync is deferred until an approved hosted backend exists.
 */
export const MSAL_SESSION_TOKEN = 'msal'

export function isStaticDemoBuild(): boolean {
  const flag = import.meta.env?.VITE_STATIC_DEMO
  return flag === '1' || flag === 'true'
}

export function isLocalPersistence(): boolean {
  if (isStaticDemoBuild()) return true
  try {
    const session = getStoredSession()
    if (!session) return true
    if (session.token === 'local-demo' || session.token === MSAL_SESSION_TOKEN) return true
    if (session.user?.authMethod === 'microsoft') return true
    return false
  } catch {
    return true
  }
}

export function saveButtonLabel(saving: boolean): string {
  if (saving) return 'Saving…'
  return isLocalPersistence() ? 'Save changes' : 'Save changes to database'
}

export function savedMessageLabel(): string {
  if (isWorkspaceShared()) return 'Saved for everyone'
  return isLocalPersistence() ? 'Saved in this browser' : 'Saved to database'
}
