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

export function microsoftAuthErrorCode(err: unknown): string {
  if (err instanceof BrowserAuthError) return err.errorCode
  if (typeof err === 'object' && err && 'errorCode' in err) {
    return String((err as { errorCode?: string }).errorCode ?? '')
  }
  return ''
}

export function isMicrosoftAuthCancelled(err: unknown): boolean {
  return microsoftAuthErrorCode(err) === 'user_cancelled'
}

export function userFromMicrosoftAccount(account: AccountInfo): AuthUser {
  const name = account.name?.trim() || account.username || 'Microsoft user'
  const parts = name.split(/\s+/).filter(Boolean)
  const initials = `${parts[0]?.[0] ?? 'M'}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return {
    id: account.localAccountId || account.homeAccountId,
    email: account.username || '',
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
    prompt: 'select_account',
    ...(hint ? { loginHint: hint } : {}),
  }
}

export type MicrosoftLoginResult =
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'redirect' }

export async function startMicrosoftLogin(loginHint?: string): Promise<MicrosoftLoginResult> {
  const instance = await ensureMsal()
  if (!instance) throw new MicrosoftAuthUnavailableError()

  const request = loginRequest(loginHint)
  try {
    const popup = await instance.loginPopup(request)
    if (!popup.account) throw new Error('Microsoft 365 did not return an account.')
    instance.setActiveAccount(popup.account)
    return { status: 'signed_in', user: userFromMicrosoftAccount(popup.account) }
  } catch (err) {
    if (isMicrosoftAuthCancelled(err)) throw err
    const code = microsoftAuthErrorCode(err)
    if (code === 'interaction_in_progress') {
      await instance.handleRedirectPromise().catch(() => undefined)
    }
    // Do not loginRedirect here — a full-page bounce away from the CRM is the
    // main login glitch when the popup is blocked. The login page falls back
    // to a valid email and opens the dashboard in place.
    throw err
  }
}

export async function clearMicrosoftCache(): Promise<void> {
  const instance = await ensureMsal()
  if (!instance) return
  instance.setActiveAccount(null)
  await instance.clearCache()
}

export async function microsoftLogout(): Promise<void> {
  const instance = await ensureMsal()
  if (!instance) return
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  if (!account) {
    await instance.clearCache()
    return
  }
  try {
    await instance.logoutPopup({
      account,
      postLogoutRedirectUri: spaRedirectUri(),
    })
  } catch {
    instance.setActiveAccount(null)
    await instance.clearCache()
  }
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
