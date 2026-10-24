import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { loginProviderFromEmail, loginProviderLabel } from '@/lib/emailIdentity'
import { LogOut } from 'lucide-react'

interface ProfileMenuProps {
  open: boolean
  onClose: () => void
}

export function ProfileMenu({ open, onClose }: ProfileMenuProps) {
  const { user, signOut, signingOut } = useAuth()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open || !user) return null

  return (
    <div
      ref={ref}
      className="absolute top-12 right-0 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-elevated)"
    >
      <div className="border-b border-border bg-gradient-to-br from-navy-900 to-navy-800 px-4 py-4 text-white">
        <p className="font-brand text-lg font-bold tracking-tight">{user.name}</p>
        <p className="mt-0.5 text-xs tracking-[0.08em] text-white/70 uppercase">{user.role}</p>
      </div>
      <dl className="space-y-2.5 px-4 py-3 text-sm">
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
            Work email
          </dt>
          <dd className="mt-0.5 text-ink">{user.email}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
            Auth method
          </dt>
          <dd className="mt-0.5 text-ink">
            {user.email ? loginProviderLabel(loginProviderFromEmail(user.email)) : 'Microsoft 365'}
          </dd>
        </div>
      </dl>
      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={signingOut}
          data-testid="profile-sign-out"
          onClick={() => {
            void signOut().finally(() => navigate('/login'))
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
