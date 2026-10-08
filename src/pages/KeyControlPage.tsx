import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Ban, ShieldAlert, UserX } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  fetchApiKeySlots,
  fetchSessions,
  getStoredSession,
  kickSession,
  revokeApiKeySlot,
} from '@/lib/api'
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'

type Slot = {
  id: string
  slot: number
  label: string
  key_prefix: string
  status: string
  last_used_at: string | null
}

type SessionRow = {
  id: string
  auth_method: string
  api_key_slot: number | null
  api_key_label: string | null
  user_name: string
  user_email: string
  ip_address: string | null
  created_at: string
}

const DEFAULT_SLOTS: Slot[] = [1, 2, 3, 4, 5].map((slot) => ({
  id: `key-slot-${slot}`,
  slot,
  label: slot === 1 ? 'Primary integration (demo)' : `Reserved slot ${slot}`,
  key_prefix: slot === 1 ? 'nwp_demo_' : 'nwp_pending_',
  status: slot === 1 ? 'active' : 'pending',
  last_used_at: null,
}))

/** Managerial screen: boot / revoke API keys and kick live logins. */
export function KeyControlPage() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const local = getStoredSession()?.token === 'local-demo'

  const refresh = useCallback(async () => {
    if (local) {
      setSlots(loadDemoCollection('api_key_slots', DEFAULT_SLOTS))
      setSessions(loadDemoCollection('sessions', []))
      return
    }
    try {
      const [keys, sess] = await Promise.all([fetchApiKeySlots(), fetchSessions()])
      setSlots(keys.slots)
      setSessions(sess.sessions as SessionRow[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [local])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!user?.isManager) {
    return <Navigate to="/security" replace />
  }

  const onRevoke = async (slot: number) => {
    setMessage(null)
    if (local) {
      const next = slots.map((s) =>
        s.slot === slot ? { ...s, status: 'revoked', key_prefix: 'nwp_revoked_' } : s,
      )
      saveDemoCollection('api_key_slots', next)
      setSlots(next)
      setMessage(`Slot ${slot} revoked (local demo).`)
      return
    }
    try {
      await revokeApiKeySlot(slot)
      setMessage(`Slot ${slot} revoked. Related sessions kicked.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed')
    }
  }

  const onKick = async (id: string) => {
    if (local) {
      const next = sessions.filter((s) => s.id !== id)
      saveDemoCollection('sessions', next)
      setSessions(next)
      setMessage('Session terminated (local demo).')
      return
    }
    try {
      await kickSession(id)
      setMessage('Session terminated.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kick failed')
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div className="flex items-center gap-2 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase">
            Managerial access only
          </p>
        </div>
        <h1 className="mt-1 font-brand text-2xl font-semibold tracking-tight text-navy-900">
          Boot keys & logins
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Revoke any of the five API key slots or terminate live sessions immediately.
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-[1100px] gap-5 px-6 py-6 lg:grid-cols-2 lg:px-8">
        {(message || error) && (
          <p
            className={`lg:col-span-2 rounded-lg border px-3 py-2 text-sm ${
              error
                ? 'border-attention-border bg-attention-bg text-attention'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {error ?? message}
          </p>
        )}

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <h2 className="font-brand text-lg font-semibold text-navy-900">API key slots</h2>
          <ul className="mt-4 space-y-2">
            {slots.map((slot) => (
              <li
                key={slot.slot}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Slot {slot.slot} — {slot.label}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {slot.key_prefix}… · {slot.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={slot.status === 'revoked'}
                  onClick={() => void onRevoke(slot.slot)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <h2 className="font-brand text-lg font-semibold text-navy-900">Live sessions</h2>
          <ul className="mt-4 space-y-2">
            {sessions.length === 0 && (
              <li className="py-3 text-sm text-ink-muted">No active sessions listed.</li>
            )}
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{s.user_name}</p>
                  <p className="text-xs text-ink-subtle">
                    {s.auth_method}
                    {s.api_key_slot != null ? ` · slot ${s.api_key_slot}` : ''}
                    {s.ip_address ? ` · ${s.ip_address}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onKick(s.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-attention-bg"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Kick
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
