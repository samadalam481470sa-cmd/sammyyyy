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
import { sameMailbox } from '@/lib/userPrivacy'

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
let lastRedirectError: Error | null = null
let redirectAccount: AccountInfo | null = null

const MICROSOFT_AWAITING_KEY = 'newport_msal_awaiting'
const MICROSOFT_HINT_KEY = 'newport_msal_login_hint'

export class MicrosoftAuthUnavailableError extends Error {
  constructor() {
    super(
      'Microsoft cloud sign-in is not connected. Register a Single-page app in Microsoft Entra ID and set its Application (client) ID in entra.json or VITE_MSAL_CLIENT_ID.',
    )
    this.name = 'MicrosoftAuthUnavailableError'
  }
}

/** Thrown when sign-in was handed to the real browser because this window cannot run it. */
export class MicrosoftOpenedElsewhereError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MicrosoftOpenedElsewhereError'
  }
}

/** Loopback hosts that are not registered as Entra redirect URIs. Only "localhost" is. */
const LOOPBACK_ALIASES = new Set(['127.0.0.1', '0.0.0.0', '[::1]', '::1'])

export type MicrosoftBlockReason = 'embedded' | 'insecure' | 'loopback-alias' | null

/**
 * Why Microsoft sign-in cannot run in this window:
 * - embedded: inside an iframe (Cursor / VS Code preview). Microsoft's page refuses to load in frames.
 * - insecure: plain http on a LAN IP. The browser hides WebCrypto, so MSAL cannot start.
 * - loopback-alias: 127.0.0.1 / 0.0.0.0. Entra only accepts the registered http://localhost:5173/.
 */
export function microsoftBlockReason(
  env: { href: string; framed: boolean; hasCrypto: boolean } | null = null,
): MicrosoftBlockReason {
  let href = env?.href
  let framed = env?.framed
  let hasCrypto = env?.hasCrypto
  if (!env) {
    if (typeof window === 'undefined') return null
    href = window.location.href
    try {
      framed = window.self !== window.top
    } catch {
      framed = true
    }
    hasCrypto = Boolean(window.isSecureContext !== false && window.crypto?.subtle)
  }
  let host = ''
  try {
    host = new URL(href ?? '').hostname
  } catch {
    return null
  }
  if (framed) return 'embedded'
  if (LOOPBACK_ALIASES.has(host)) return 'loopback-alias'
  if (!hasCrypto) return 'insecure'
  return null
}

/** Same page on the registered "localhost" host, so Entra accepts the redirect. */
export function registeredBrowserUrl(href: string): string {
  const url = new URL(href)
  if (LOOPBACK_ALIASES.has(url.hostname)) url.hostname = 'localhost'
  return url.toString()
}

/** Open the app in the real browser (or move to localhost) instead of failing silently. */
function handOffMicrosoftSignIn(reason: Exclude<MicrosoftBlockReason, null>): never {
  const target = registeredBrowserUrl(window.location.href)
  if (reason === 'loopback-alias') {
    window.location.assign(target)
    throw new MicrosoftOpenedElsewhereError('Moving to localhost so Microsoft accepts the sign-in…')
  }
  if (reason === 'embedded') {
    window.open(target, '_blank', 'noopener,noreferrer')
    throw new MicrosoftOpenedElsewhereError(
      'Microsoft sign-in cannot run inside the Cursor preview. The app opened in your browser — sign in there. If nothing opened, copy this address into Chrome or Edge: ' +
        target,
    )
  }
  throw new MicrosoftOpenedElsewhereError(
    'Microsoft sign-in needs a secure address. Open http://localhost:5173 on this computer, or the live link https://samadalam481470sa-cmd.github.io/sammyyyy/.',
  )
}

const COMMON_AUTHORITY = 'https://login.microsoftonline.com/common'

/** Public SPA client ID. Not a secret. Work + personal Microsoft accounts. */
export const ENTRA_SPA_CLIENT_ID = '2e296364-cbf0-4742-ba8f-3e0615a4e777'

let resolvedClientId =
  (import.meta.env.VITE_MSAL_CLIENT_ID ?? '').trim() || ENTRA_SPA_CLIENT_ID

export function msalClientId(): string {
  return resolvedClientId
}

export function isMsalConfigured(): boolean {
  return msalClientId().length > 0
}

export function msalAuthority(): string {
  return COMMON_AUTHORITY
}

/** "code=…&state=…" (or "error=…&state=…") from Microsoft, in a query or a fragment. */
export function isAuthResponseString(raw: string): boolean {
  const body = raw.replace(/^[#?]/, '')
  if (!body || body.startsWith('/')) return false
  const params = new URLSearchParams(body)
  return params.has('state') && (params.has('code') || params.has('error'))
}

/** True when this URL is Microsoft handing back a sign-in result. */
export function urlCarriesAuthResponse(href: string): boolean {
  try {
    const url = new URL(href)
    if (url.searchParams.has('code') || url.searchParams.has('error') || url.searchParams.has('state')) return true
    return isAuthResponseString(url.hash)
  } catch {
    return false
  }
}

/**
 * True inside a window MSAL opened for itself: the Connect Outlook popup, or a hidden
 * token-renewal iframe. The CRM must not render or touch the address there, because
 * MSAL in the main window reads the sign-in result from that address.
 */
export function isMsalChildWindow(): boolean {
  if (typeof window === 'undefined') return false
  let framed = false
  try {
    framed = window.self !== window.top
  } catch {
    framed = true
  }
  if (framed) return urlCarriesAuthResponse(window.location.href)
  return Boolean(window.opener) && String(window.name || '').startsWith('msal.')
}

/**
 * MSAL 4 returns the sign-in result in the URL fragment (#code=…). The CRM uses hash
 * routing, so the router would treat "#code=…" as a page and erase it before MSAL reads
 * it ("Microsoft did not finish sign-in"). Capture it as soon as this module loads, which
 * is before React renders, and hand it to MSAL directly.
 */
let pendingAuthResponse: string | null = null
if (typeof window !== 'undefined' && !isMsalChildWindow() && isAuthResponseString(window.location.hash)) {
  pendingAuthResponse = window.location.hash
  window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${window.location.search}`)
}

export function hasEntraRedirectReturn(href?: string): boolean {
  if (href === undefined) {
    if (pendingAuthResponse) return true
    if (typeof window === 'undefined') return false
    return urlCarriesAuthResponse(window.location.href)
  }
  return urlCarriesAuthResponse(href)
}

/** Future app registrations replace the client ID in entra.json. Empty keeps the built-in default. */
export function clientIdFromEntraDocument(
  json: { clientId?: string } | null | undefined,
  fallback = ENTRA_SPA_CLIENT_ID,
): string {
  const id = String(json?.clientId ?? '').trim()
  return id || fallback
}

/** Load entra.json on top of the built-in client ID so the Azure app can be swapped later. */
export async function loadEntraConfig(): Promise<void> {
  if (typeof fetch === 'undefined' || typeof document === 'undefined') return
  try {
    const res = await fetch(new URL('entra.json', document.baseURI).href, { cache: 'no-store' })
    if (!res.ok) return
    const json = (await res.json()) as { clientId?: string }
    const next = clientIdFromEntraDocument(json, resolvedClientId || ENTRA_SPA_CLIENT_ID)
    if (next !== resolvedClientId) {
      resolvedClientId = next
      pca = null
      initPromise = null
    }
  } catch {
    if (!resolvedClientId) resolvedClientId = ENTRA_SPA_CLIENT_ID
  }
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

const RETURN_ERROR_KEY = 'newport_msal_return_error'

export function rememberMicrosoftReturnError(message: string): void {
  try {
    sessionStorage.setItem(RETURN_ERROR_KEY, message)
  } catch {
    // ignore
  }
}

export function consumeMicrosoftReturnErrorMessage(): string | null {
  try {
    const msg = sessionStorage.getItem(RETURN_ERROR_KEY)
    if (msg) sessionStorage.removeItem(RETURN_ERROR_KEY)
    return msg
  } catch {
    return null
  }
}

export function applyAuthRedirectCleanup(): void {
  if (typeof window === 'undefined') return
  const fromUrl = entraReturnErrorFromLocation(window.location.href)
  if (fromUrl) rememberMicrosoftReturnError(fromUrl)
  const next = stripAuthRedirectQuery(window.location.href)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) {
    window.history.replaceState({}, document.title, next)
  }
}

/** Microsoft cloud error on the return URL (password cancelled, AADSTS, etc.). */
export function entraReturnErrorFromLocation(
  href = typeof window === 'undefined' ? '' : window.location.href,
): string | null {
  try {
    const url = new URL(href)
    const error = url.searchParams.get('error')
    if (!error) return null
    const desc = (url.searchParams.get('error_description') ?? '').replace(/\+/g, ' ')
    if (error === 'access_denied' || /cancel/i.test(desc)) {
      return 'Microsoft sign-in was cancelled. Try again.'
    }
    const first = desc.split('\n')[0].trim()
    return first.slice(0, 280) || 'Microsoft could not complete sign-in.'
  } catch {
    return null
  }
}

export function consumeMicrosoftRedirectError(): Error | null {
  const err = lastRedirectError
  lastRedirectError = null
  return err
}

export type MicrosoftCloudReturn =
  | { kind: 'authenticated'; account: AccountInfo }
  | { kind: 'denied'; message: string }
  | { kind: 'unknown'; hint: string | null; detail: string | null }
  | { kind: 'none' }

function readMicrosoftHint(): string | null {
  try {
    const hint = sessionStorage.getItem(MICROSOFT_HINT_KEY)?.trim() ?? ''
    return hint.includes('@') ? hint : null
  } catch {
    return null
  }
}

function clearMicrosoftAttempt(): void {
  try {
    sessionStorage.removeItem(MICROSOFT_AWAITING_KEY)
  } catch {
    // ignore
  }
}

/** Microsoft accepted this browser return, refused it, or never gave a clear result. */
export function consumeMicrosoftCloudReturn(): MicrosoftCloudReturn {
  const account = redirectAccount
  redirectAccount = null
  const err = consumeMicrosoftRedirectError()
  const urlMessage = consumeMicrosoftReturnErrorMessage()
  let awaiting = false
  try {
    awaiting = sessionStorage.getItem(MICROSOFT_AWAITING_KEY) === '1'
  } catch {
    awaiting = false
  }
  const hint = readMicrosoftHint()

  const denied =
    (err && isMicrosoftCredentialDenied(err)) ||
    Boolean(urlMessage && /cancelled|access_denied/i.test(urlMessage))
  if (denied) {
    clearMicrosoftAttempt()
    const message =
      'Microsoft did not accept this sign-in. Enter your username and password on Microsoft’s page and try again.'
    rememberMicrosoftReturnError(message)
    return { kind: 'denied', message }
  }
  const signedInAccount = account ?? (awaiting ? getMicrosoftAccount() : null)
  if (signedInAccount) {
    clearMicrosoftAttempt()
    return { kind: 'authenticated', account: signedInAccount }
  }
  if (err || urlMessage || awaiting) {
    clearMicrosoftAttempt()
    return { kind: 'unknown', hint, detail: signInErrorDetail(err, urlMessage) }
  }
  return { kind: 'none' }
}

/** Plain-language reason from Microsoft's error, when it gave one. */
export function signInErrorDetail(err: unknown, urlMessage?: string | null): string | null {
  const text = `${err instanceof Error ? err.message : ''} ${urlMessage ?? ''}`.trim()
  if (!text) return null
  if (/AADSTS50020|AADSTS700016|not enabled for consumers|unauthorized_client/i.test(text)) {
    return 'Microsoft blocked this account type for the Newport app registration. The app registration must allow accounts in any organization and personal Microsoft accounts.'
  }
  if (/AADSTS65001|AADSTS90094|AADSTS90095|admin/i.test(text)) {
    return 'Your organization requires an IT admin to approve the Newport app before you can sign in. A personal Outlook.com account can sign in now.'
  }
  if (/AADSTS50011|redirect/i.test(text)) {
    return 'Microsoft rejected the return address for this page. Open the official Newport link and sign in again.'
  }
  const first = text.split('\n')[0].replace(/\s+/g, ' ').trim()
  return first ? first.slice(0, 220) : null
}

export function microsoftLoginInProgress(): boolean {
  if (hasEntraRedirectReturn()) return true
  try {
    return sessionStorage.getItem(MICROSOFT_AWAITING_KEY) === '1'
  } catch {
    return false
  }
}

export function markMicrosoftLoginStarted(loginHint?: string): void {
  try {
    sessionStorage.setItem(MICROSOFT_AWAITING_KEY, '1')
    const hint = loginHint?.trim()
    if (hint) sessionStorage.setItem(MICROSOFT_HINT_KEY, hint)
    else sessionStorage.removeItem(MICROSOFT_HINT_KEY)
  } catch {
    // ignore
  }
}

function clearStuckMicrosoftInteraction(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key && key.includes('interaction.status')) keys.push(key)
    }
    for (const key of keys) sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

const CANCELLED_CODES = new Set(['user_cancelled', 'user_canceled', 'access_denied'])
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
  if (CANCELLED_CODES.has(microsoftAuthErrorCode(err))) return true
  const message = err instanceof Error ? err.message : ''
  return /access_denied|user_cancel/i.test(message)
}

/** Microsoft explicitly refused or the user backed out. Wrong passwords stay on Microsoft's page. */
export function isMicrosoftCredentialDenied(err: unknown): boolean {
  return isMicrosoftAuthCancelled(err)
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
  const claims = account.idTokenClaims as { preferred_username?: string; email?: string; upn?: string } | undefined
  const email = (account.username || claims?.preferred_username || claims?.email || claims?.upn || '').trim()
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
  if (!msalClientId()) return null
  // MSAL cannot start (or would hang) in a preview iframe or an insecure page. Skip it fast.
  const blocked = microsoftBlockReason()
  if (blocked === 'embedded' || blocked === 'insecure') return null
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
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    })
    await instance.initialize()
    const returning = hasEntraRedirectReturn()
    const connect = takeOutlookConnect()
    try {
      const captured = pendingAuthResponse
      pendingAuthResponse = null
      const result: AuthenticationResult | null = await instance.handleRedirectPromise(captured ?? undefined)
      if (connect) {
        // This trip was Connect Outlook, not a CRM sign-in. The CRM user stays as is.
        if (result?.account && connect.owner) {
          writeMailBinding(connect.owner, result.account.homeAccountId)
          lastConnectError = null
        } else if (!result?.account) {
          lastConnectError = 'Microsoft did not finish connecting Outlook. Click Connect Outlook to try again.'
        }
      } else if (result?.account) {
        redirectAccount = result.account
        instance.setActiveAccount(result.account)
      } else if (returning) {
        const existing = instance.getAllAccounts()[0]
        if (existing) {
          redirectAccount = existing
          instance.setActiveAccount(existing)
        }
      } else {
        const existing = instance.getAllAccounts()[0]
        if (existing) instance.setActiveAccount(existing)
      }
    } catch (err) {
      if (connect) {
        // A failed Outlook connection must not sign the CRM user out.
        lastConnectError = describeGraphError(err)
      } else {
        lastRedirectError = err instanceof Error ? err : new Error(String(err))
        rememberMicrosoftReturnError(lastRedirectError.message)
      }
    }
    if (connect && returning) {
      // Back to the page where Connect Outlook was clicked, before the router starts.
      window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}${connect.returnHash}`)
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

export function buildMicrosoftLoginRequest(loginHint?: string): PopupRequest & RedirectRequest {
  const hint = loginHint?.trim()
  return {
    scopes: LOGIN_SCOPES,
    prompt: 'login',
    ...(hint ? { loginHint: hint } : {}),
  }
}

export type MicrosoftLoginResult =
  | { status: 'signed_in'; user: AuthUser }
  | { status: 'redirect' }

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

export async function startMicrosoftLogin(loginHint?: string): Promise<MicrosoftLoginResult> {
  const blocked = microsoftBlockReason()
  if (blocked) handOffMicrosoftSignIn(blocked)
  const instance = await ensureMsal()
  if (!instance) throw new MicrosoftAuthUnavailableError()

  const hint = loginHint?.trim()
  markMicrosoftLoginStarted(hint)
  const request = buildMicrosoftLoginRequest(hint)
  try {
    await instance.loginRedirect(request)
  } catch (err) {
    if (microsoftAuthErrorCode(err) !== 'interaction_in_progress') throw err
    clearStuckMicrosoftInteraction()
    await instance.loginRedirect(request)
  }
  return { status: 'redirect' }
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
  const instance = await ensureMsal()
  if (!instance) {
    purgeMicrosoftAuthStorage()
    return
  }
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  if (!account) {
    await instance.clearCache()
    purgeMicrosoftAuthStorage()
    return
  }
  try {
    await instance.logoutRedirect({
      account,
      postLogoutRedirectUri: spaRedirectUri(),
    })
  } catch {
    instance.setActiveAccount(null)
    await instance.clearCache()
    purgeMicrosoftAuthStorage()
  }
}

/** Silent Graph token, then the official popup only when Microsoft requires interaction. No prompt=consent or prompt=login. */
export function buildGraphTokenRequest<T extends object>(scopes: string[], account: T): { scopes: string[]; account: T } {
  return { scopes, account }
}

export async function getGraphAccessToken(
  scopes: string[] = GRAPH_FILE_SCOPES,
  options?: { interactive?: boolean; loginHint?: string; mode?: 'popup' | 'redirect' },
): Promise<string | null> {
  const interactive = options?.interactive !== false
  // Microsoft's page only opens on an explicit request (the Connect Outlook button),
  // never from a background sync.
  const explicit = options?.interactive === true
  lastGraphTokenError = null
  const instance = await ensureMsal()
  if (!instance) {
    lastGraphTokenError = 'Microsoft sign-in could not start in this window.'
    return null
  }
  const hint = graphLoginHint(options?.loginHint)
  const owner = crmOwnerEmail()
  const accounts = instance.getAllAccounts()
  const boundId = owner ? readMailBinding(owner) : null
  // A CRM user may use any Microsoft account they connected themselves, or the
  // Microsoft account they signed in to the CRM with. Nothing else.
  const belongsToUser = (row: AccountInfo) =>
    (boundId !== null && row.homeAccountId === boundId) || (owner !== '' && sameMailbox(row.username, owner))
  const account = owner
    ? (accounts.find((row) => boundId !== null && row.homeAccountId === boundId) ??
      accounts.find((row) => sameMailbox(row.username, owner)) ??
      null)
    : (instance.getActiveAccount() ?? accounts[0] ?? null)
  if (owner) {
    // Accounts left in this tab by someone else are removed.
    for (const other of accounts) {
      if (belongsToUser(other)) continue
      try {
        await instance.clearCache({ account: other })
      } catch {
        // stale entry; ignore
      }
    }
  }

  // No Microsoft account connected for this user yet. Microsoft's account picker opens,
  // and the user signs in with any work, school, or personal Outlook account of their own.
  if (!account) {
    if (!explicit) return null
    const fresh = { scopes, prompt: 'select_account', loginHint: hint }
    return options?.mode === 'redirect' ? graphRedirect(instance, fresh, owner) : graphPopup(instance, fresh, owner)
  }

  const request = buildGraphTokenRequest(scopes, account)
  try {
    const silent = await instance.acquireTokenSilent(request)
    lastConnectError = null
    return silent.accessToken
  } catch (err) {
    if (!interactive) return null
    if (!(err instanceof InteractionRequiredAuthError) && !(err instanceof BrowserAuthError)) {
      lastGraphTokenError = describeGraphError(err)
      return null
    }
    return options?.mode === 'redirect' ? graphRedirect(instance, request, owner) : graphPopup(instance, request, owner)
  }
}

const OUTLOOK_CONNECT_KEY = 'newport_msal_connect_pending'
let lastConnectError: string | null = null

/** Read and clear the Connect Outlook round trip started in this tab, if any. */
function takeOutlookConnect(): { owner: string; returnHash: string } | null {
  try {
    const raw = sessionStorage.getItem(OUTLOOK_CONNECT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(OUTLOOK_CONNECT_KEY)
    const row = JSON.parse(raw) as { owner?: string; returnHash?: string }
    const returnHash = typeof row.returnHash === 'string' && row.returnHash.startsWith('#/') ? row.returnHash : '#/email'
    return { owner: String(row.owner ?? ''), returnHash }
  } catch {
    return null
  }
}

/**
 * Connect Outlook with a full-page trip to Microsoft's account picker. The person picks
 * or types any work, school, or personal Microsoft account of their own, then comes back
 * to the same CRM page. (A popup would land on this app and lose the result.)
 */
async function graphRedirect(
  instance: PublicClientApplication,
  request: RedirectRequest,
  owner: string,
): Promise<string | null> {
  const returnHash =
    typeof window !== 'undefined' && window.location.hash.startsWith('#/') ? window.location.hash : '#/email'
  try {
    sessionStorage.setItem(OUTLOOK_CONNECT_KEY, JSON.stringify({ owner, returnHash }))
  } catch {
    // storage blocked; Microsoft still returns, the binding just is not saved
  }
  let failure: unknown = null
  try {
    await instance.acquireTokenRedirect(request)
  } catch (err) {
    failure = err
    if (microsoftAuthErrorCode(err) === 'interaction_in_progress') {
      clearStuckMicrosoftInteraction()
      try {
        await instance.acquireTokenRedirect(request)
        failure = null
      } catch (again) {
        failure = again
      }
    }
  }
  if (failure) {
    try {
      sessionStorage.removeItem(OUTLOOK_CONNECT_KEY)
    } catch {
      // ignore
    }
    lastGraphTokenError = describeGraphError(failure)
    return null
  }
  // The browser is leaving for Microsoft's page. Stay in the "Connecting…" state.
  return new Promise<string | null>(() => undefined)
}

const MAIL_BINDING_KEY = 'newport_msal_mail_account'

/** Email of the person logged in to the CRM in this tab. */
function crmOwnerEmail(): string {
  try {
    const raw = sessionStorage.getItem('newport_crm_session_user')
    const email = raw ? String((JSON.parse(raw) as { email?: string }).email ?? '') : ''
    return email.trim().toLowerCase()
  } catch {
    return ''
  }
}

/** The Microsoft account this CRM user connected for mail. Kept for this tab only. */
function readMailBinding(owner: string): string | null {
  try {
    const raw = sessionStorage.getItem(MAIL_BINDING_KEY)
    if (!raw) return null
    const row = JSON.parse(raw) as { owner?: string; homeAccountId?: string }
    return row.owner === owner && typeof row.homeAccountId === 'string' ? row.homeAccountId : null
  } catch {
    return null
  }
}

function writeMailBinding(owner: string, homeAccountId: string): void {
  try {
    sessionStorage.setItem(MAIL_BINDING_KEY, JSON.stringify({ owner, homeAccountId }))
  } catch {
    // storage blocked; the token still works for this request
  }
}

let lastGraphTokenError: string | null = null

/** Plain reason the last Graph token request failed. Null when it worked or was not tried. */
export function graphTokenError(): string | null {
  return lastGraphTokenError ?? lastConnectError
}

function graphLoginHint(explicit?: string): string | undefined {
  const fromArg = explicit?.trim()
  if (fromArg) return fromArg
  try {
    const raw = sessionStorage.getItem('newport_crm_session_user')
    const email = raw ? String((JSON.parse(raw) as { email?: string }).email ?? '').trim() : ''
    return email.includes('@') ? email : undefined
  } catch {
    return undefined
  }
}

function describeGraphError(err: unknown): string {
  const code = (err as { errorCode?: string })?.errorCode ?? ''
  const text = err instanceof Error ? err.message : String(err)
  if (code === 'popup_window_error' || code === 'empty_window_error') {
    return 'The browser blocked the Microsoft popup. Allow popups for this site and click Connect Outlook again.'
  }
  if (code === 'user_cancelled') return 'The Microsoft window was closed before sign-in finished.'
  if (/AADSTS65001|AADSTS90094|admin/i.test(text)) {
    return 'Your organization requires an admin to approve mail access for this app. Ask your IT admin to grant consent, or connect a personal Outlook.com account.'
  }
  if (/AADSTS50020|AADSTS50011/i.test(text)) {
    return 'Microsoft rejected this account or redirect address for the app registration.'
  }
  return text || 'Microsoft sign-in failed.'
}

async function graphPopup(
  instance: PublicClientApplication,
  request: PopupRequest,
  owner: string,
): Promise<string | null> {
  try {
    const result = await instance.acquireTokenPopup(request)
    // Remember which Microsoft account this CRM user connected. Any account works:
    // work, school, or personal Outlook. It is never shared with another CRM user.
    if (owner && result.account) writeMailBinding(owner, result.account.homeAccountId)
    return result.accessToken
  } catch (err) {
    lastGraphTokenError = describeGraphError(err)
    return null
  }
}
