import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Copy, KeyRound, ShieldPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  fetchApiKeySlots,
  getStoredSession,
  provisionApiKeySlot,
} from '@/lib/api'
import {
  loadDemoCollection,
  registerLocalIssuedKey,
  saveDemoCollection,
} from '@/lib/demoStore'

type Slot = {
  id: string
  slot: number
  label: string
  key_prefix: string
  status: string
  last_used_at: string | null
}

const DEFAULT_SLOTS: Slot[] = [1, 2, 3, 4, 5].map((slot) => ({
  id: `key-slot-${slot}`,
  slot,
  label: slot === 1 ? 'Primary integration (demo)' : `Reserved slot ${slot}`,
  key_prefix: slot === 1 ? 'nwp_demo_' : 'nwp_pending_',
  status: slot === 1 ? 'active' : 'pending',
  last_used_at: null,
}))

/** Managerial screen: issue / rotate API keys into the five slots. */
export function KeyProvisionPage() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [label, setLabel] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(2)
  const [issued, setIssued] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const local = getStoredSession()?.token === 'local-demo'

  const refresh = useCallback(async () => {
    if (local) {
      setSlots(loadDemoCollection('api_key_slots', DEFAULT_SLOTS))
      return
    }
    try {
      const keys = await fetchApiKeySlots()
      setSlots(keys.slots)
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

  const onProvision = async () => {
    setIssued(null)
    setMessage(null)
    setError(null)
    if (local) {
      const plaintext = `nwp_slot${selectedSlot}_local_${Date.now().toString(36)}`
      const next = slots.map((s) =>
        s.slot === selectedSlot
          ? {
              ...s,
              status: 'active',
              label: label.trim() || `Provisioned slot ${selectedSlot}`,
              key_prefix: plaintext.slice(0, 12),
            }
          : s,
      )
      saveDemoCollection('api_key_slots', next)
      await registerLocalIssuedKey(selectedSlot, plaintext)
      setSlots(next)
      setIssued(plaintext)
      setMessage('Key issued (local demo). Copy it now — it will not be shown again.')
      return
    }
    try {
      const result = await provisionApiKeySlot(selectedSlot, label.trim() || undefined)
      setIssued(result.plaintext)
      setMessage(result.notice)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provision failed')
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <div className="flex items-center gap-2 text-emerald-800">
          <ShieldPlus className="h-5 w-5" />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase">
            Managerial access only
          </p>
        </div>
        <h1 className="mt-1 font-brand text-2xl font-semibold tracking-tight text-navy-900">
          Provision access
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Issue or rotate one of the five partner API keys. Only the hash is stored — plaintext is
          shown once.
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-[900px] gap-5 px-6 py-6 lg:px-8">
        {(message || error) && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              error
                ? 'border-attention-border bg-attention-bg text-attention'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {error ?? message}
          </p>
        )}

        <section className="rounded-xl border border-border bg-surface p-6 shadow-(--shadow-card)">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
                Target slot
              </span>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(Number(e.target.value))}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent"
              >
                {[1, 2, 3, 4, 5].map((s) => {
                  const meta = slots.find((x) => x.slot === s)
                  return (
                    <option key={s} value={s}>
                      Slot {s}
                      {meta ? ` — ${meta.status}` : ''}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
                Label
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. External counsel integration"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void onProvision()}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <KeyRound className="h-4 w-4" />
            Issue / rotate key
          </button>

          {issued && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-amber-900 uppercase">
                Plaintext key — copy now
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-navy-900">
                  {issued}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(issued)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <h2 className="font-brand text-lg font-semibold text-navy-900">Current slots</h2>
          <ul className="mt-3 divide-y divide-border">
            {slots.map((s) => (
              <li key={s.slot} className="flex justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-ink">
                  Slot {s.slot} — {s.label}
                </span>
                <span className="text-xs tracking-wide text-ink-muted uppercase">{s.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
