import {
  createContext,
  useCallback,
  useContext,
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

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  signInDemo: () => Promise<void>
  signInWithApiKey: (apiKey: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getStoredSession()
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null)

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
      storeSession('local-demo', demoUser)
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
      signInDemo,
      signInWithApiKey,
      signOut,
    }),
    [user, signInDemo, signInWithApiKey, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
