import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from '@/types'
import { clearSession, getStoredSession, signOut as apiSignOut, storeSession } from '@/lib/api'
import {
  LAST_EMAIL_KEY,
  LAST_PROVIDER_KEY,
  displayNameFromEmail,
  initialsFromName,
  loginProviderFromEmail,
  normalizeEmail,
  parseLoginEmail,
  type LoginProvider,
} from '@/lib/emailIdentity'
import { readProofBlob, verifySessionProof, newSessionToken } from '@/lib/sessionProof'
import { assertLoginAllowed, recordLoginFailure, recordLoginSuccess } from '@/lib/loginThrottle'
import { sha256Hex } from '@/lib/sha256'
import {
  clearMicrosoftCache,
  consumeMicrosoftCloudReturn,
  ensureMsal,
  getMicrosoftAccount,
  hasEntraRedirectReturn,
  isMsalConfigured,
  loadEntraConfig,
  microsoftLogout,
  startMicrosoftLogin,
  userFromMicrosoftAccount,
} from '@/auth/msal'
import { attachVaultUnloadFlush, commitAllPendingEdits, flushAllUserVaults } from '@/lib/userVault'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  authReady: boolean
  signingOut: boolean
  signInWithEmail: (email: string, provider?: LoginProvider) => Promise<void>
  signInWithMicrosoft: (loginHint?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function userFromEmailAddress(email: string): AuthUser {
  const name = displayNameFromEmail(email)
  return {
    id: email,
    email,
    name,
    role: 'partner',
    initials: initialsFromName(name),
    authMethod: 'microsoft',
    isManager: false,
    apiKeyId: null,
    apiKeySlot: null,
    apiKeyLabel: null,
  }
}

async function rememberLastEmail(email: string, provider?: LoginProvider) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email)
    localStorage.setItem(LAST_PROVIDER_KEY, provider ?? loginProviderFromEmail(email))
  } catch {
    // ignore
  }
}

async function sessionFromMicrosoftAccount(account: ReturnType<typeof getMicrosoftAccount>) {
  if (!account) return null
  const user = userFromMicrosoftAccount(account)
  await storeSession(await newSessionToken(), user, await sha256Hex(user.email || user.id))
  await rememberLastEmail(user.email)
  return user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(
    () => !getStoredSession() && !hasEntraRedirectReturn(),
  )
  const [signingOut, setSigningOut] = useState(false)
  const epochRef = useRef(0)
  const signingOutRef = useRef(false)
  const hydrateEnabledRef = useRef(true)
  const signInLockRef = useRef(false)

  const hydrate = useCallback(async () => {
    const epoch = epochRef.current
    if (signingOutRef.current || !hydrateEnabledRef.current) return
    if (isMsalConfigured()) {
      try {
        await ensureMsal()
      } catch {
        // Email sessions must still restore when Entra is not configured.
      }
      const returned = consumeMicrosoftCloudReturn()
      if (returned.kind === 'authenticated') {
        const next = await sessionFromMicrosoftAccount(returned.account)
        if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
        recordLoginSuccess()
        setUser(next)
        return
      }
      if (returned.kind === 'denied') {
        if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
        setUser(null)
        return
      }
      if (returned.kind === 'unknown' && returned.hint) {
        const next = userFromEmailAddress(returned.hint)
        await storeSession(await newSessionToken(), next, await sha256Hex(next.email))
        await rememberLastEmail(next.email, 'microsoft')
        if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
        recordLoginSuccess()
        setUser(next)
        return
      }
      if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
      const account = getMicrosoftAccount()
      if (account) {
        try {
          const msUser = userFromMicrosoftAccount(account)
          const storedMs = getStoredSession()
          const proofMs = readProofBlob()
          if (storedMs?.user && proofMs) {
            const sameEmail =
              normalizeEmail(storedMs.user.email || '') === normalizeEmail(msUser.email || '')
            const ok = sameEmail && (await verifySessionProof(storedMs.token, storedMs.user, proofMs))
            if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
            if (ok) {
              await storeSession(storedMs.token, storedMs.user, proofMs.fingerprint)
              if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
              setUser(storedMs.user)
              return
            }
            // A leftover Entra account must not replace a different email session.
          } else {
            const next = await sessionFromMicrosoftAccount(account)
            if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
            setUser(next)
            return
          }
        } catch {
          // Incomplete Entra account — restore the email session instead.
        }
      }
    }

    const stored = getStoredSession()
    const proof = readProofBlob()
    if (stored?.user && proof) {
      const ok = await verifySessionProof(stored.token, stored.user, proof)
      if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
      if (ok) {
        await storeSession(stored.token, stored.user, proof.fingerprint)
        if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
        setUser(stored.user)
        return
      }
      clearSession()
    }
    if (epoch !== epochRef.current || signingOutRef.current || !hydrateEnabledRef.current) return
    setUser(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadEntraConfig()
      .then(() => hydrate())
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    const id = window.setInterval(() => {
      void hydrate()
    }, 60_000)
    const detachUnload = attachVaultUnloadFlush()
    return () => {
      cancelled = true
      window.clearInterval(id)
      detachUnload()
    }
  }, [hydrate])

  const establishSession = useCallback(async (next: AuthUser, provider?: LoginProvider) => {
    epochRef.current += 1
    signingOutRef.current = false
    hydrateEnabledRef.current = true
    const email = next.email || next.id
    await storeSession(await newSessionToken(), next, await sha256Hex(email))
    if (next.email) await rememberLastEmail(next.email, provider)
    recordLoginSuccess()
    setUser(next)
    setSigningOut(false)
  }, [])

  const signInWithEmail = useCallback(async (raw: string, provider?: LoginProvider) => {
    if (signInLockRef.current) throw new Error('Sign-in already in progress.')
    const gate = assertLoginAllowed()
    if (!gate.ok) throw new Error(gate.error)
    const parsed = parseLoginEmail(raw)
    if (!parsed.ok) {
      recordLoginFailure()
      throw new Error(parsed.error)
    }
    signInLockRef.current = true
    try {
      const next = userFromEmailAddress(parsed.email)
      await clearMicrosoftCache().catch(() => undefined)
      await establishSession(next, provider)
    } finally {
      signInLockRef.current = false
    }
  }, [establishSession])

  const signInWithMicrosoft = useCallback(async (loginHint?: string) => {
    if (signInLockRef.current) throw new Error('Sign-in already in progress.')
    const gate = assertLoginAllowed()
    if (!gate.ok) throw new Error(gate.error)
    const hint = loginHint?.trim()
    if (hint) {
      const parsed = parseLoginEmail(hint)
      if (!parsed.ok) {
        recordLoginFailure()
        throw new Error(parsed.error.replace('work email', 'Microsoft email'))
      }
    }
    signInLockRef.current = true
    try {
      await loadEntraConfig()
      if (hint) await rememberLastEmail(hint, 'microsoft')
      const result = await startMicrosoftLogin(hint)
      if (result.status === 'redirect') return
      await establishSession(result.user, 'microsoft')
    } finally {
      signInLockRef.current = false
    }
  }, [establishSession])

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    hydrateEnabledRef.current = false
    setSigningOut(true)
    try {
      await commitAllPendingEdits()
      flushAllUserVaults()
      epochRef.current += 1
      try {
        await apiSignOut()
      } catch {
        // Static demo has no auth API.
      }
      clearSession()
      setUser(null)
      try {
        sessionStorage.removeItem('newport_post_login_path')
      } catch {
        // ignore
      }
      try {
        await microsoftLogout()
      } catch {
        await clearMicrosoftCache().catch(() => undefined)
      }
    } finally {
      signingOutRef.current = false
      setSigningOut(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      authReady,
      signingOut,
      signInWithEmail,
      signInWithMicrosoft,
      signOut,
    }),
    [user, authReady, signingOut, signInWithEmail, signInWithMicrosoft, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
