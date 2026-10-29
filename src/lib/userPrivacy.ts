/**
 * Per-user privacy for a shared browser.
 *
 * Personal data: Outlook mail caches, sync markers, delta links, Microsoft (MSAL)
 * sign-in tokens, login hints, and the CRM session itself. None of it may outlive
 * the user who created it.
 *
 * Shared company data (opportunities, contacts, carriers, documents and so on under
 * newport_crm_demo_v1_*) is not touched.
 */

const PERSONAL_PREFIXES = ['newport_outlook_', 'newport_msal_', 'msal.', 'msal-']
const SESSION_KEYS = [
  'newport_crm_session_token',
  'newport_crm_session_user',
  'newport_crm_session_proof',
  'newport_crm_last_email',
  'newport_crm_last_login_provider',
  'newport_crm_workspace_session',
]

function normalize(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase()
}

function keysOf(store: Storage): string[] {
  const keys: string[] = []
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (key) keys.push(key)
  }
  return keys
}

function eachStore(run: (store: Storage) => void): void {
  for (const pick of [() => localStorage, () => sessionStorage]) {
    try {
      run(pick())
    } catch {
      // storage blocked (private mode)
    }
  }
}

/** True when the key holds personal mail or sign-in data. */
export function isPersonalKey(key: string): boolean {
  return PERSONAL_PREFIXES.some((prefix) => key.startsWith(prefix)) || SESSION_KEYS.includes(key)
}

/** Remove every personal key from this browser. Used on logout. */
export function purgePersonalData(): void {
  eachStore((store) => {
    for (const key of keysOf(store)) if (isPersonalKey(key)) store.removeItem(key)
  })
}

/**
 * Remove personal mail data that belongs to anyone except `email`.
 * Used on sign-in, so a user who closed the tab without logging out
 * never leaks mail to the next person.
 */
export function purgeOtherUsersMail(email: string): void {
  const me = normalize(email)
  eachStore((store) => {
    for (const key of keysOf(store)) {
      if (!key.startsWith('newport_outlook_')) continue
      const owner = key.includes(':') ? normalize(key.slice(key.indexOf(':') + 1)) : ''
      if (!owner || owner !== me) store.removeItem(key)
    }
  })
}

/** Microsoft account usernames match the CRM login (case-insensitive). */
export function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalize(a)
  return Boolean(left) && left === normalize(b)
}
