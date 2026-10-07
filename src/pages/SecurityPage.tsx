import { useEffect, useState } from 'react'
import { fetchApiKeySlots, fetchAuditLogs } from '@/lib/api'
import { KeyRound, ScrollText, Shield } from 'lucide-react'

export function SecurityPage() {
  const [slots, setSlots] = useState<
    Array<{
      slot: number
      label: string
      key_prefix: string
      status: string
      last_used_at: string | null
    }>
  >([])
  const [logs, setLogs] = useState<
    Array<{
      id: string
      actor_name: string | null
      action: string
      detail: string
      created_at: string
    }>
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [keys, audit] = await Promise.all([fetchApiKeySlots(), fetchAuditLogs(30)])
        setSlots(keys.slots)
        setLogs(audit)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security data')
      }
    })()
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">Security</h1>
        <p className="mt-1 text-sm text-ink-muted">
          API key infrastructure (5 slots), audit trail, and access controls. Keys are provisioned
          by the security team — this app only stores hashes.
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-6 py-6 lg:grid-cols-2 lg:px-8">
        {error && (
          <p className="lg:col-span-2 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">API key slots (5)</h2>
          </div>
          <ul className="space-y-2">
            {slots.map((slot) => (
              <li
                key={slot.slot}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Slot {slot.slot} — {slot.label}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    Prefix {slot.key_prefix}… ·{' '}
                    {slot.last_used_at ? `Last used ${slot.last_used_at}` : 'Never used'}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    slot.status === 'active'
                      ? 'bg-success-bg text-success'
                      : slot.status === 'pending'
                        ? 'bg-warning-bg text-warning'
                        : 'bg-canvas text-ink-muted'
                  }`}
                >
                  {slot.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-subtle">
            Security team will issue the five production keys. Demo key exists only for slot 1 in
            local environments.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">Controls in place</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink">
            <li>• Auth required for all CRM data routes</li>
            <li>• API keys hashed (SHA-256); plaintext never stored</li>
            <li>• Session tokens hashed; 8–12 hour expiry</li>
            <li>• Role checks (admin / partner / analyst / viewer)</li>
            <li>• Rate limiting on auth and API</li>
            <li>• Helmet security headers</li>
            <li>• Request body size limits</li>
            <li>• Audit log for sign-in and opportunity updates</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card) lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">Recent audit activity</h2>
          </div>
          <ul className="divide-y divide-border">
            {logs.length === 0 && (
              <li className="py-3 text-sm text-ink-muted">No audit events yet.</li>
            )}
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <span className="font-semibold">{log.actor_name ?? 'System'}</span> —{' '}
                    {log.action}
                  </p>
                  <p className="text-xs text-ink-muted">{log.detail}</p>
                </div>
                <span className="text-[11px] text-ink-subtle">{log.created_at}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
