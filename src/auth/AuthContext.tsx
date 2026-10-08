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
import {
  apiKeySignIn,
  clearSession,
  demoSignIn,
  getStoredSession,
  storeSession,
  signOut as apiSignOut,
} from '@/lib/api'
import { DEMO_FINGERPRINT } from '@/lib/credentialHashes'
import { LOCAL_TOKEN, readProofBlob, verifySessionProof } from '@/lib/sessionProof'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  authReady: boolean
  signInDemo: () => Promise<void>
  signInWithApiKey: (apiKey: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const hydrate = useCallback(async () => {
    const stored = getStoredSession()
    if (!stored) {
      setUser(null)
      return
    }
    const ok = await verifySessionProof(stored.token, stored.user, readProofBlob())
    if (!ok) {
      clearSession()
      setUser(null)
      return
    }
    setUser(stored.user)
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

  const signInDemo = useCallback(async () => {
    try {
      const data = await demoSignIn()
      setUser(data.user)
    } catch {
      const demoUser: AuthUser = {
        id: 'user-dennis',
        email: 'dennis@newportspecialty.demo',
        name: 'Dennis DiCapua',
        role: 'partner',
        initials: 'DD',
        authMethod: 'demo',
        isManager: false,
        apiKeyId: null,
        apiKeySlot: null,
        apiKeyLabel: null,
      }
      await storeSession(LOCAL_TOKEN, demoUser, DEMO_FINGERPRINT)
      setUser(demoUser)
    }
  }, [])

  const signInWithApiKey = useCallback(async (apiKey: string) => {
    const data = await apiKeySignIn(apiKey.trim())
    setUser(data.user)
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      authReady,
      signInDemo,
      signInWithApiKey,
      signOut,
    }),
    [user, authReady, signInDemo, signInWithApiKey, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
