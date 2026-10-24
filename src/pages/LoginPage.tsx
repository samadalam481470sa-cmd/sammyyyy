import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isMsalConfigured } from '@/auth/msal'
import newportLogo from '@/assets/newport-logo.png'

function postLoginPath(): string {
  try {
    const stored = sessionStorage.getItem('newport_post_login_path')
    sessionStorage.removeItem('newport_post_login_path')
    if (stored && stored !== '/login') return stored
  } catch {
    // ignore
  }
  return '/'
}

export function LoginPage() {
  const { isAuthenticated, authReady, signInWithMicrosoft } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const configured = isMsalConfigured()

  useEffect(() => {
    if (!authReady || isAuthenticated || !configured) return
    setBusy(true)
    setError(null)
    void signInWithMicrosoft().catch((err) => {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Microsoft sign-in failed')
    })
  }, [authReady, isAuthenticated, configured, signInWithMicrosoft])

  if (!authReady) return <div className="min-h-full bg-[#040b16]" aria-busy="true" />
  if (isAuthenticated) return <Navigate to={postLoginPath()} replace />

  return (
    <div
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-5"
      style={{
        background:
          'linear-gradient(90deg, #040b16 0%, #061525 28%, #0b2a4d 58%, #1e5a8c 82%, #3d7eb8 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_40%,rgba(61,126,184,0.35),transparent_55%)]" />
      <div className="relative w-full max-w-[26rem] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-(--shadow-elevated)">
        <div className="border-b border-border">
          <img
            src={newportLogo}
            alt="Newport Specialty Partners"
            className="h-24 w-full object-cover object-center"
          />
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-[11px] tracking-[0.14em] text-ink-muted uppercase">
            Acquisition Management Platform
          </p>
          <h1 className="mt-2 font-brand text-xl font-bold text-navy-900">
            {busy ? 'Redirecting to Microsoft 365' : 'Sign in with Microsoft 365'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Use your Microsoft account (@outlook.com or work). After Microsoft authenticates you,
            the dashboard opens.
          </p>
          {(error || !configured) && (
            <p className="mt-4 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-left text-sm text-attention">
              {error ||
                'Microsoft 365 sign-in is not connected for this deployment. Register an Entra SPA app (personal + work accounts) with this site as a redirect URI, then set VITE_MSAL_CLIENT_ID.'}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError(null)
              void signInWithMicrosoft().catch((err) => {
                setBusy(false)
                setError(err instanceof Error ? err.message : 'Microsoft sign-in failed')
              })
            }}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            Continue with Microsoft
          </button>
        </div>
      </div>
      <p className="relative mt-3 max-w-[26rem] text-center text-[10px] leading-snug text-white/50">
        © 2026 Newport Specialty Partners. Authorized users only.
      </p>
    </div>
  )
}
