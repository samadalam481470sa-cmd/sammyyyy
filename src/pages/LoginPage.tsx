import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'

export function LoginPage() {
  const { isAuthenticated, signInDemo, signInWithApiKey } = useAuth()
  const navigate = useNavigate()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const onDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInDemo()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const onApiKey = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithApiKey(apiKey.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API key rejected')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(61,126,184,0.18),_transparent_55%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8 shadow-(--shadow-elevated)">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 font-brand text-lg font-bold text-white">
            N
          </div>
          <div>
            <p className="font-brand text-lg font-bold text-navy-900">NEWPORT SPECIALTY PARTNERS</p>
            <p className="text-xs tracking-[0.08em] text-ink-muted uppercase">
              Acquisition CRM · Secure Access
            </p>
          </div>
        </div>

        <h1 className="font-brand text-2xl font-bold text-navy-900">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          One-stop acquisition tracking for deal status, outstanding work, and diligence
          progress. Access is gated by session or API key.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => void onDemo()}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          Sign in (Demo) — enter dashboard
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] tracking-wide text-ink-subtle uppercase">or API key</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void onApiKey(e)} className="space-y-3">
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            API key (5 slots · security team provisions)
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="nwp_••••••••"
              className="h-11 w-full rounded-xl border border-border bg-canvas pr-3 pl-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <button
            type="submit"
            disabled={busy || apiKey.trim().length < 16}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-canvas text-sm font-semibold text-ink transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
            Authenticate with API key
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention">
            {error}
          </p>
        )}

        <ul className="mt-6 space-y-1.5 text-[11px] text-ink-subtle">
          <li>• Sessions expire automatically; tokens are hashed at rest.</li>
          <li>• API keys: only hashes stored — never plaintext secrets.</li>
          <li>• Rate-limited auth endpoints · audit logging enabled.</li>
        </ul>
      </div>
    </div>
  )
}
