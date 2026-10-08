import { useEffect, useRef } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { LogOut, Shield } from 'lucide-react'

interface ProfileMenuProps {
  open: boolean
  onClose: () => void
}

export function ProfileMenu({ open, onClose }: ProfileMenuProps) {
  const { user, signOut } = useAuth()
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
        <p className="mt-0.5 text-xs tracking-[0.08em] text-white/70 uppercase">
          {user.role}
          {user.isManager ? ' · Managerial' : ''}
        </p>
      </div>
      <dl className="space-y-2.5 px-4 py-3 text-sm">
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
            User ID
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-ink">{user.id}</dd>
        </div>
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
          <dd className="mt-0.5 text-ink">{user.authMethod ?? 'session'}</dd>
        </div>
        {(user.apiKeyId || user.apiKeySlot) && (
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
              API key
            </dt>
            <dd className="mt-0.5 text-ink">
              {user.apiKeySlot != null ? `Slot ${user.apiKeySlot}` : 'Managerial'}
              {user.apiKeyLabel ? ` — ${user.apiKeyLabel}` : ''}
            </dd>
            {user.apiKeyId && (
              <dd className="mt-0.5 font-mono text-[11px] text-ink-muted">{user.apiKeyId}</dd>
            )}
          </div>
        )}
      </dl>
      {user.isManager && (
        <p className="mx-4 mb-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
          <Shield className="h-3.5 w-3.5" />
          Managerial master key — can revoke and provision access slots
        </p>
      )}
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
