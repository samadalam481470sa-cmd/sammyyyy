import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { dashboardPathAfterLogin } from '@/lib/loginDestination'
import {
  consumeMicrosoftReturnErrorMessage,
  isMicrosoftAuthCancelled,
  isMicrosoftCredentialDenied,
} from '@/auth/msal'
import { LAST_EMAIL_KEY, LAST_PROVIDER_KEY, parseLoginEmail } from '@/lib/emailIdentity'
import { attachLoginShield } from '@/lib/loginGuard'
import newportLogo from '@/assets/newport-logo.png'

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

export function LoginPage() {
  const { isAuthenticated, authReady, signInWithMicrosoft } = useAuth()
  const [email, setEmail] = useState('')
  const [allowTyping, setAllowTyping] = useState(false)
  const [error, setError] = useState<string | null>(() => consumeMicrosoftReturnErrorMessage())
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    return attachLoginShield(root)
  }, [])

  useEffect(() => {
    try {
      localStorage.removeItem(LAST_EMAIL_KEY)
      localStorage.removeItem(LAST_PROVIDER_KEY)
    } catch {
      // shared browsers must not keep the previous person's address
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    const message = consumeMicrosoftReturnErrorMessage()
    if (message) setError(message)
  }, [authReady])

  if (!authReady) return <div className="min-h-full bg-[#040b16]" aria-busy="true" />
  if (isAuthenticated) return <Navigate to={dashboardPathAfterLogin()} replace />

  const fail = (message: string) => {
    inFlightRef.current = false
    setBusy(false)
    setError(message)
    emailRef.current?.focus()
  }

  const onEmailSignIn = (event: FormEvent) => {
    event.preventDefault()
    onMicrosoft365()
  }

  const onMicrosoft365 = () => {
    if (inFlightRef.current) return
    const typed = email.trim()
    let hint: string | undefined
    if (typed) {
      const parsed = parseLoginEmail(typed)
      if (!parsed.ok) {
        fail(parsed.error.replace('work email', 'Microsoft email'))
        return
      }
      hint = parsed.email
    }
    inFlightRef.current = true
    setBusy(true)
    setError(null)
    const here = window.location.href
    const stuck = window.setTimeout(() => {
      if (!inFlightRef.current || window.location.href !== here) return
      fail('Microsoft’s sign-in page did not open. Check the connection and try again.')
    }, 12000)
    void (async () => {
      try {
        await signInWithMicrosoft(hint)
      } catch (err) {
        window.clearTimeout(stuck)
        if (isMicrosoftCredentialDenied(err) || isMicrosoftAuthCancelled(err)) {
          fail('Microsoft did not accept this sign-in. Enter your username and password on Microsoft’s page and try again.')
          return
        }
        fail(err instanceof Error ? err.message : 'Microsoft cloud sign-in did not open. Try again.')
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
            Continue to Microsoft and enter your real username and password there. Microsoft checks them, then this dashboard opens.
          </p>

          <form autoComplete="off" noValidate onSubmit={onEmailSignIn}>
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
                    Microsoft Entra ID · any firm, Outlook.com, or work account
                  </p>
                </div>
              </div>

              <label
                htmlFor="microsoft-email"
                className="mt-4 block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
              >
                Microsoft email
              </label>
              <input
                ref={emailRef}
                id="microsoft-email"
                data-testid="login-microsoft-email"
                type="email"
                name="newport-sign-in-email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                readOnly={!allowTyping}
                inputMode="email"
                value={email}
                placeholder="Work or Outlook email — left blank"
                onFocus={() => setAllowTyping(true)}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Leave this blank. Each person types their own account on Microsoft’s page. Newport never sees or stores the password.
              </p>

              {error && (
                <p
                  data-testid="login-error"
                  className="mt-3 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={onMicrosoft365}
                data-testid="login-microsoft-365"
                className="mt-4 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-[#2f2f2f] text-lg font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                <MicrosoftMark className="h-7 w-7" />
                {busy ? 'Opening Microsoft…' : 'Sign in on Microsoft'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="relative mt-3 flex max-w-[28rem] flex-col items-center gap-2 text-center">
        <p className="text-[10px] leading-snug text-white/70">
          Secured by Microsoft. Password entry stays on login.microsoftonline.com. This screen does not remember the last account.
        </p>
        <p className="text-[11px] text-white/80">
          <a className="underline" download href={`${import.meta.env.BASE_URL}download/Install-Newport-CRM.cmd`}>
            Download for Windows
          </a>
          <span className="px-2 text-white/40">·</span>
          <a className="underline" download href={`${import.meta.env.BASE_URL}download/Install-Newport-CRM.command`}>
            Download for Mac
          </a>
        </p>
        <p className="max-w-sm text-[10px] leading-snug text-white/50">
          Each person downloads once and signs in with their own Microsoft account. Later deploys open automatically the next time the app is online.
        </p>
      </div>
    </div>
  )
}
