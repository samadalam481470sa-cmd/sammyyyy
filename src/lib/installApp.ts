/**
 * Real app install (Progressive Web App). Chrome and Edge install Newport CRM into
 * Applications / the Start menu with its own icon and window. Updates arrive with each
 * deploy. Safari on Mac uses File > Add to Dock.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Call once at startup, before the browser fires its install event. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Running as the installed app window. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function canPromptInstall(): boolean {
  return deferred != null
}

export type InstallOutcome = 'installed' | 'dismissed' | 'manual'

/** Open the browser's install dialog when it is available. */
export async function promptInstall(): Promise<InstallOutcome> {
  if (!deferred) return 'manual'
  const event = deferred
  deferred = null
  await event.prompt()
  const choice = await event.userChoice
  notify()
  return choice.outcome === 'accepted' ? 'installed' : 'dismissed'
}

/** Steps for browsers that do not offer the install dialog. */
export function manualInstallSteps(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const ua = userAgent.toLowerCase()
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('edg')
  if (/iphone|ipad/.test(ua)) return 'On iPhone or iPad: tap Share, then Add to Home Screen.'
  if (isSafari) return 'In Safari: choose File > Add to Dock. Newport CRM then opens from the Dock like any app.'
  if (ua.includes('edg')) return 'In Edge: open the ... menu, then Apps > Install Newport CRM. If it is already installed, open it from your apps.'
  if (ua.includes('chrome')) return 'In Chrome: click the install icon at the right end of the address bar, or open the ⋮ menu > Cast, save, and share > Install page as app. If it is already installed, open it from your apps.'
  return 'Open this site in Chrome, Edge, or Safari to install Newport CRM as an app.'
}
