import {
  BrowserAuthError,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  type PopupRequest,
  type RedirectRequest,
} from '@azure/msal-browser'
import type { AuthUser } from '@/types'

export const LOGIN_SCOPES = ['openid', 'profile', 'email', 'User.Read']
export const GRAPH_FILE_SCOPES = ['User.Read', 'Files.ReadWrite']

const AUTH_QUERY_KEYS = [
  'code',
  'state',
  'client_info',
  'session_state',
  'error',
  'error_description',
  'iss',
] as const

let pca: PublicClientApplication | null = null
let initPromise: Promise<PublicClientApplication | null> | null = null

export class MicrosoftAuthUnavailableError extends Error {
  constructor() {
    super('Microsoft 365 is not connected for this deployment.')
    this.name = 'MicrosoftAuthUnavailableError'
  }
}

export function msalClientId(): string {
  return (import.meta.env.VITE_MSAL_CLIENT_ID ?? '').trim()
}

export function isMsalConfigured(): boolean {
  return msalClientId().length > 0
}

export function msalAuthority(): string {
  const tenant = (import.meta.env.VITE_MSAL_TENANT ?? 'common').trim() || 'common'
  return `https://login.microsoftonline.com/${tenant}`
}

const APP_ROUTE =
  /\/(?:login|opportunities|relationships|tasks|sources|carriers|documents|reports|meetings|settings|security(?:\/.*)?)\/?$/i

/** Stable SPA redirect: origin + app base, never a React route or hash. */
export function spaRedirectUriFromLocation(href: string): string {
  const url = new URL(href)
  let path = url.pathname.replace(/\/index\.html$/i, '/')
  path = path.replace(APP_ROUTE, '/')
  if (!path.endsWith('/')) path += '/'
  return `${url.origin}${path}`
}

export function spaRedirectUri(): string {
  if (typeof window === 'undefined') return 'http://localhost:5173/'
  return spaRedirectUriFromLocation(window.location.href)
}

export function stripAuthRedirectQuery(href: string): string {
  const url = new URL(href)
  for (const key of AUTH_QUERY_KEYS) url.searchParams.delete(key)
  const search = url.searchParams.toString()
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`
}

export function applyAuthRedirectCleanup(): void {
  if (typeof window === 'undefined') return
  const next = stripAuthRedirectQuery(window.location.href)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) {
    window.history.replaceState({}, document.title, next)
  }
}

const CANCELLED_CODES = new Set(['user_cancelled', 'user_canceled'])
const FALLBACK_CODES = new Set([
  'popup_window_error',
  'empty_window_error',
  'monitor_window_timeout',
  'popup_window_closed',
  'interaction_in_progress',
  'hash_empty_error',
  'uninitialized_public_client_application',
  'no_token_request_cache_error',
  'endpoints_resolution_error',
  'network_error',
  'pkce_not_created',
  'crypto_nonexistent',
  'block_iframe_reload',
])

export function microsoftAuthErrorCode(err: unknown): string {
  if (err instanceof BrowserAuthError) return err.errorCode
  if (typeof err === 'object' && err && 'errorCode' in err) {
    return String((err as { errorCode?: string }).errorCode ?? '')
  }
  return ''
}

export function isMicrosoftAuthCancelled(err: unknown): boolean {
  return CANCELLED_CODES.has(microsoftAuthErrorCode(err))
}

/** Popup blocked, timed out, or Entra unavailable — continue with a valid email. */
export function isMicrosoftAuthFallback(err: unknown): boolean {
  if (err instanceof MicrosoftAuthUnavailableError) return true
  if (isMicrosoftAuthCancelled(err)) return false
  const code = microsoftAuthErrorCode(err)
  if (code && FALLBACK_CODES.has(code)) return true
  return true
}

export function userFromMicrosoftAccount(account: AccountInfo): AuthUser {
  const email = (account.username || '').trim()
  if (!email.includes('@')) {
    throw new Error('Microsoft 365 did not return an email address.')
  }
  const name = account.name?.trim() || email.split('@')[0] || 'Microsoft user'
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = `${parts[0]?.[0] ?? 'M'}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return {
    id: account.localAccountId || account.homeAccountId || email,
    email,
    name,
    role: 'partner',
    initials: initials.slice(0, 2),
    authMethod: 'microsoft',
    isManager: false,
    apiKeyId: null,
    apiKeySlot: null,
    apiKeyLabel: null,
  }
}

export async function ensureMsal(): Promise<PublicClientApplication | null> {
  if (pca) return pca
  if (initPromise) return initPromise
  initPromise = (async () => {
    const clientId = msalClientId()
    if (!clientId) return null
    const instance = new PublicClientApplication({
      auth: {
        clientId,
        authority: msalAuthority(),
        redirectUri: spaRedirectUri(),
        postLogoutRedirectUri: spaRedirectUri(),
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    })
    await instance.initialize()
    const result: AuthenticationResult | null = await instance.handleRedirectPromise()
    if (result?.account) instance.setActiveAccount(result.account)
    else {
      const existing = instance.getAllAccounts()[0]
      if (existing) instance.setActiveAccount(existing)
    }
    applyAuthRedirectCleanup()
    pca = instance
    return instance
  })()
  try {
    return await initPromise
  } catch {
    initPromise = null
    pca = null
    return null
  }
}

export function getMicrosoftAccount(): AccountInfo | null {
  if (!pca) return null
  return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null
}

function loginRequest(loginHint?: string): PopupRequest & RedirectRequest {
  const hint = loginHint?.trim()
  return {
    scopes: LOGIN_SCOPES,
    ...(hint ? { loginHint: hint } : { prompt: 'select_account' }),
  }
}

export type MicrosoftLoginResult = { status: 'signed_in'; user: AuthUser }

const POPUP_TIMEOUT_MS = 25_000

function withPopupTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Microsoft 365 sign-in timed out.'), { errorCode: 'monitor_window_timeout' }))
    }, POPUP_TIMEOUT_MS)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export function purgeMicrosoftAuthStorage(): void {
  const wipe = (store: Storage) => {
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key && (key.startsWith('msal.') || key.startsWith('msal-'))) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  }
  try {
    if (typeof localStorage !== 'undefined') wipe(localStorage)
  } catch {
    // ignore
  }
  try {
    if (typeof sessionStorage !== 'undefined') wipe(sessionStorage)
  } catch {
    // ignore
  }
}

async function resetMicrosoftInteraction(instance: PublicClientApplication): Promise<void> {
  await instance.handleRedirectPromise().catch(() => undefined)
  purgeMicrosoftAuthStorage()
}

export async function startMicrosoftLogin(loginHint?: string): Promise<MicrosoftLoginResult> {
  const instance = await ensureMsal()
  if (!instance) throw new MicrosoftAuthUnavailableError()

  const request = loginRequest(loginHint)
  const runPopup = async () => {
    const popup = await withPopupTimeout(instance.loginPopup(request))
    if (!popup.account) throw new Error('Microsoft 365 did not return an account.')
    instance.setActiveAccount(popup.account)
    return { status: 'signed_in' as const, user: userFromMicrosoftAccount(popup.account) }
  }

  try {
    return await runPopup()
  } catch (err) {
    if (isMicrosoftAuthCancelled(err)) throw err
    if (microsoftAuthErrorCode(err) === 'interaction_in_progress') {
      await resetMicrosoftInteraction(instance)
      try {
        return await runPopup()
      } catch (retryErr) {
        if (isMicrosoftAuthCancelled(retryErr)) throw retryErr
        throw retryErr
      }
    }
    // Never loginRedirect — a full-page bounce is the main Microsoft login fault.
    throw err
  }
}

export async function clearMicrosoftCache(): Promise<void> {
  try {
    const instance = await ensureMsal()
    if (instance) {
      instance.setActiveAccount(null)
      await instance.clearCache()
    }
  } catch {
    // still wipe leftover Entra keys below
  }
  purgeMicrosoftAuthStorage()
}

export async function microsoftLogout(): Promise<void> {
  // Local cache only. logoutPopup / logoutRedirect bounce the CRM off the
  // dashboard and back, which is the main sign-out glitch.
  await clearMicrosoftCache()
}

export async function getGraphAccessToken(scopes: string[] = GRAPH_FILE_SCOPES): Promise<string | null> {
  const instance = await ensureMsal()
  const account = instance?.getActiveAccount() ?? instance?.getAllAccounts()[0]
  if (!instance || !account) return null
  try {
    const silent = await instance.acquireTokenSilent({ scopes, account })
    return silent.accessToken
  } catch (err) {
    if (!(err instanceof InteractionRequiredAuthError)) return null
    try {
      const popup = await instance.acquireTokenPopup({ scopes, account })
      return popup.accessToken
    } catch {
      return null
    }
  }
}
