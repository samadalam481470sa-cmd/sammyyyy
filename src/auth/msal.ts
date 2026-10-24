import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser'
import type { AuthUser } from '@/types'

export const LOGIN_SCOPES = ['openid', 'profile', 'email', 'User.Read']
export const GRAPH_FILE_SCOPES = ['User.Read', 'Files.ReadWrite']

let pca: PublicClientApplication | null = null
let initPromise: Promise<PublicClientApplication | null> | null = null

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

export function spaRedirectUri(): string {
  if (typeof window === 'undefined') return 'http://localhost:5173/'
  const url = new URL(window.location.href)
  let path = url.pathname.replace(/\/index\.html$/i, '/')
  if (!path.endsWith('/')) path += '/'
  return `${url.origin}${path}`
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

export async function startMicrosoftLogin(): Promise<void> {
  const instance = await ensureMsal()
  if (!instance) {
    throw new Error(
      'Microsoft 365 sign-in is not connected for this deployment. Register an Entra SPA app and set VITE_MSAL_CLIENT_ID.',
    )
  }
  if (instance.getActiveAccount() || instance.getAllAccounts().length > 0) return
  await instance.loginRedirect({
    scopes: LOGIN_SCOPES,
    prompt: 'select_account',
  })
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
  await instance.logoutRedirect({
    account,
    postLogoutRedirectUri: spaRedirectUri(),
  })
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
