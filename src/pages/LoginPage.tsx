import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { dashboardPathAfterLogin } from '@/lib/loginDestination'
import { isMicrosoftAuthCancelled } from '@/auth/msal'
import {
  LAST_EMAIL_KEY,
  LAST_PROVIDER_KEY,
  loginProviderFromEmail,
  parseLoginEmail,
  type LoginProvider,
} from '@/lib/emailIdentity'
import { attachLoginShield } from '@/lib/loginGuard'
import { recordLoginFailure } from '@/lib/loginThrottle'
import newportLogo from '@/assets/newport-logo.png'

function lastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function lastProvider(): LoginProvider {
  try {
    const stored = localStorage.getItem(LAST_PROVIDER_KEY)
    if (stored === 'microsoft' || stored === 'outlook' || stored === 'gmail' || stored === 'other') {
      return stored
    }
    const email = lastEmail()
    if (email) return loginProviderFromEmail(email)
  } catch {
    // ignore
  }
  return 'microsoft'
}

const PROVIDERS: Record<
  LoginProvider,
  { title: string; hint: string; placeholder: string; accounts: string }
> = {
  microsoft: {
    title: 'Microsoft 365',
    hint: 'Work Microsoft 365, Outlook.com, Hotmail, Live, or MSN.',
    placeholder: 'you@outlook.com',
    accounts: 'Microsoft 365 work · Outlook.com · Hotmail · Live · MSN',
  },
  outlook: {
    title: 'Outlook',
    hint: 'Outlook.com, Hotmail, Live, and MSN inboxes.',
    placeholder: 'you@outlook.com',
    accounts: '@outlook.com · @hotmail.com · @live.com',
  },
  gmail: {
    title: 'Gmail',
    hint: 'Gmail and Google Workspace addresses.',
    placeholder: 'you@gmail.com',
    accounts: '@gmail.com · Google Workspace',
  },
  other: {
    title: 'Other email',
    hint: 'Any other work or personal email. We check that it is valid, then open the dashboard.',
    placeholder: 'you@company.com',
    accounts: 'company or personal email',
  },
}

function MicrosoftMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

function OutlookMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="#0078D4" />
      <path d="M4 7.2 12 13l8-5.8V8L12 14 4 8V7.2Z" fill="#fff" />
    </svg>
  )
}

function GmailMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M3 6.5 12 13l9-6.5V6H3v.5Z" />
      <path fill="#34A853" d="M21 6v12h-4V9.2L12 13 7 9.2V18H3V6l9 6.5L21 6Z" />
      <path fill="#FBBC05" d="M3 6v12h4V9.2L3 6Z" />
      <path fill="#4285F4" d="M21 6l-4 3.2V18h4V6Z" />
    </svg>
  )
}

function OtherMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 7.5 12 13l8-5.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

export function LoginPage() {
  const { isAuthenticated, authReady, signInWithEmail, signInWithMicrosoft } = useAuth()
  const [provider, setProvider] = useState<LoginProvider>(lastProvider)
  const [email, setEmail] = useState(lastEmail)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const inFlightRef = useRef(false)
  const copy = PROVIDERS[provider]

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    return attachLoginShield(root)
  }, [])

  if (!authReady) return <div className="min-h-full bg-[#040b16]" aria-busy="true" />
  if (isAuthenticated) return <Navigate to={dashboardPathAfterLogin()} replace />

  const fail = (message: string) => {
    inFlightRef.current = false
    setBusy(false)
    setError(message)
    emailRef.current?.focus()
  }

  const pickProvider = (next: LoginProvider) => {
    setProvider(next)
    setError(null)
    window.setTimeout(() => {
      emailRef.current?.focus()
      emailRef.current?.select()
    }, 0)
  }

  const finishEmailSignIn = async (nextProvider: LoginProvider) => {
    const parsed = parseLoginEmail(email)
    if (!parsed.ok) {
      recordLoginFailure()
      setError(
        nextProvider === 'microsoft'
          ? parsed.error.replace('work email', 'Microsoft 365 email')
          : parsed.error,
      )
      emailRef.current?.focus()
      return false
    }
    await signInWithEmail(parsed.email, nextProvider)
    return true
  }

  const onEmailSignIn = async (event: FormEvent) => {
    event.preventDefault()
    if (provider === 'microsoft') {
      onMicrosoft365()
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    setError(null)
    try {
      const ok = await finishEmailSignIn(provider)
      if (!ok) {
        inFlightRef.current = false
        setBusy(false)
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  const onMicrosoft365 = () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setProvider('microsoft')
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        await signInWithMicrosoft(email.trim() || undefined)
      } catch (err) {
        if (isMicrosoftAuthCancelled(err)) {
          fail('Microsoft 365 sign-in was cancelled. Try again.')
          return
        }
        fail(err instanceof Error ? err.message : 'Enter a Microsoft 365 email to continue.')
      }
    })()
  }

  return (
    <div
      data-testid="login-page"
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-5"
      style={{
        background:
          'linear-gradient(90deg, #040b16 0%, #061525 28%, #0b2a4d 58%, #1e5a8c 82%, #3d7eb8 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_40%,rgba(61,126,184,0.35),transparent_55%)]" />
      <div className="relative w-full max-w-[28rem] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-(--shadow-elevated)">
        <div className="border-b border-border">
          <img
            src={newportLogo}
            alt="Newport Specialty Partners"
            className="h-24 w-full object-cover object-center"
          />
        </div>
        <div className="px-6 py-7">
          <p className="text-center text-[11px] tracking-[0.14em] text-ink-muted uppercase">
            Acquisition Management Platform
          </p>
          <h1 className="mt-2 text-center font-brand text-xl font-bold text-navy-900">
            Sign in with Microsoft
          </h1>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Microsoft SSO opens the dashboard. Outlook, Gmail, or other email sit underneath.
          </p>

          <form noValidate onSubmit={(e) => void onEmailSignIn(e)}>
            <div
              data-testid="login-microsoft-card"
              className="mt-5 rounded-2xl border-2 border-navy-900 bg-[#f4f7fb] px-5 py-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-border">
                  <MicrosoftMark className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                  <p className="font-brand text-xl font-bold text-navy-900">Microsoft SSO</p>
                  <p className="text-xs leading-snug text-ink-muted">
                    Single sign-on into the dashboard
                  </p>
                </div>
              </div>

              {provider === 'microsoft' && (
                <div className="mt-4 space-y-3">
                  <label
                    htmlFor="work-email"
                    className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
                  >
                    Microsoft email
                  </label>
                  <input
                    ref={emailRef}
                    id="work-email"
                    data-testid="login-email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    autoFocus
                    value={email}
                    placeholder={PROVIDERS.microsoft.placeholder}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                    className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="text-[11px] leading-snug text-ink-muted">{PROVIDERS.microsoft.hint}</p>
                  {error && (
                    <p
                      data-testid="login-error"
                      className="rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention"
                    >
                      {error}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={onMicrosoft365}
                data-testid="login-microsoft-365"
                className="mt-4 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-[#2f2f2f] text-lg font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                <MicrosoftMark className="h-7 w-7" />
                {busy && provider === 'microsoft' ? 'Signing in…' : 'Sign in with Microsoft'}
              </button>
              {provider === 'microsoft' && (
                <button
                  type="submit"
                  className="hidden"
                  data-testid="login-continue"
                  tabIndex={-1}
                  disabled={busy}
                >
                  Continue with Microsoft
                </button>
              )}
            </div>

            <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
              Or continue with
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busy}
                data-testid="login-outlook"
                onClick={() => pickProvider('outlook')}
                className={`flex h-24 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  provider === 'outlook'
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-border bg-canvas text-ink hover:bg-accent-soft'
                }`}
              >
                <OutlookMark className="h-7 w-7" />
                Outlook
                <span className={`text-[9px] font-normal leading-tight ${provider === 'outlook' ? 'text-white/80' : 'text-ink-muted'}`}>
                  Outlook.com
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="login-gmail"
                onClick={() => pickProvider('gmail')}
                className={`flex h-24 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  provider === 'gmail'
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-border bg-canvas text-ink hover:bg-accent-soft'
                }`}
              >
                <GmailMark className="h-7 w-7" />
                Gmail
                <span className={`text-[9px] font-normal leading-tight ${provider === 'gmail' ? 'text-white/80' : 'text-ink-muted'}`}>
                  @gmail.com
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="login-other"
                onClick={() => pickProvider('other')}
                className={`flex h-24 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  provider === 'other'
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-border bg-canvas text-ink hover:bg-accent-soft'
                }`}
              >
                <OtherMark className="h-7 w-7" />
                Other email
                <span className={`text-[9px] font-normal leading-tight ${provider === 'other' ? 'text-white/80' : 'text-ink-muted'}`}>
                  work / personal
                </span>
              </button>
            </div>

            {provider !== 'microsoft' && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-canvas px-4 py-4">
                <label
                  htmlFor="work-email"
                  className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
                >
                  {copy.title} email
                </label>
                <input
                  ref={emailRef}
                  id="work-email"
                  data-testid="login-email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  placeholder={copy.placeholder}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <p className="text-[11px] leading-snug text-ink-muted">
                  {copy.hint} Connect {copy.accounts}.
                </p>
                {error && (
                  <p
                    data-testid="login-error"
                    className="rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  data-testid="login-continue"
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {busy ? 'Signing in…' : `Continue with ${copy.title}`}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
      <p className="relative mt-3 max-w-[28rem] text-center text-[10px] leading-snug text-white/50">
        © 2026 Newport Specialty Partners. Authorized users only.
      </p>
    </div>
  )
}
