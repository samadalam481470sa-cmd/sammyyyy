import { loginProviderFromEmail } from '@/lib/emailIdentity'

/** Microsoft consumer tenant. Personal Outlook.com / Hotmail / Live accounts use it. */
export const MICROSOFT_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

const WINDOW_NAME = 'newport-outlook-mail'
const WINDOW_FEATURES = 'popup=yes,width=1280,height=840,left=80,top=40'

let opened: Window | null = null

/**
 * Personal Microsoft accounts open outlook.live.com.
 * Work and every other account open outlook.office.com, which routes Microsoft accounts.
 */
export function outlookWebUrl(email: string, tenantId?: string | null): string {
  if (tenantId && tenantId === MICROSOFT_CONSUMER_TENANT) return 'https://outlook.live.com/mail/'
  if (loginProviderFromEmail(email) === 'outlook') return 'https://outlook.live.com/mail/'
  return 'https://outlook.office.com/mail/'
}

export type OutlookWindowResult = 'focused' | 'opened' | 'blocked'

/** Open or focus the official Outlook window. Must run inside the click that requested it. */
export function openOutlookMailWindow(email: string, tenantId?: string | null): OutlookWindowResult {
  const url = outlookWebUrl(email, tenantId)
  if (opened && !opened.closed) {
    opened.focus()
    return 'focused'
  }
  const child = window.open(url, WINDOW_NAME, WINDOW_FEATURES)
  if (!child) return 'blocked'
  try {
    child.opener = null
  } catch {
    // The Outlook window is cross-origin. Focus still uses the handle we hold.
  }
  opened = child
  child.focus()
  return 'opened'
}

/** Present only when a public Google OAuth client id was already configured. Never invent one. */
export function configuredGoogleClientId(raw = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')): string {
  return raw.trim()
}
