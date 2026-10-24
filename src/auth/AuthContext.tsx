import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from '@/types'
import { clearSession, getStoredSession, signOut as apiSignOut, storeSession } from '@/lib/api'
import { readProofBlob, verifySessionProof, MSAL_TOKEN } from '@/lib/sessionProof'
import { sha256Hex } from '@/lib/sha256'
import {
  ensureMsal,
  getMicrosoftAccount,
  isMsalConfigured,
  microsoftLogout,
  startMicrosoftLogin,
  userFromMicrosoftAccount,
} from '@/auth/msal'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  authReady: boolean
  signInWithMicrosoft: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function sessionFromMicrosoftAccount(account: ReturnType<typeof getMicrosoftAccount>) {
  if (!account) return null
  const user = userFromMicrosoftAccount(account)
  await storeSession(MSAL_TOKEN, user, await sha256Hex(user.id))
  return user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const hydrate = useCallback(async () => {
    await ensureMsal()
    const account = getMicrosoftAccount()
    if (account) {
      const next = await sessionFromMicrosoftAccount(account)
      setUser(next)
      return
    }

    const stored = getStoredSession()
    if (import.meta.env.DEV && stored?.user.authMethod === 'microsoft') {
      const ok = await verifySessionProof(stored.token, stored.user, readProofBlob())
      if (ok) {
        setUser(stored.user)
        return
      }
    }

    if (stored) clearSession()
    setUser(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void hydrate().finally(() => {
      if (!cancelled) setAuthReady(true)
    })
    const id = window.setInterval(() => {
      void hydrate()
    }, 20_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [hydrate])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as Window & { __newportDevMicrosoftLogin?: () => Promise<void> }
    w.__newportDevMicrosoftLogin = async () => {
      const devUser: AuthUser = {
        id: 'ms-oid-mary-dev',
        email: 'mary@outlook.com',
        name: 'Mary Sbaschnig',
        role: 'partner',
        initials: 'MS',
        authMethod: 'microsoft',
        isManager: false,
        apiKeyId: null,
        apiKeySlot: null,
        apiKeyLabel: null,
      }
      await storeSession(MSAL_TOKEN, devUser, await sha256Hex(devUser.id))
      setUser(devUser)
    }
    return () => {
      delete w.__newportDevMicrosoftLogin
    }
  }, [])

  const signInWithMicrosoft = useCallback(async () => {
    await startMicrosoftLogin()
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    clearSession()
    setUser(null)
    if (isMsalConfigured()) {
      await microsoftLogout()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      authReady,
      signInWithMicrosoft,
      signOut,
    }),
    [user, authReady, signInWithMicrosoft, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
