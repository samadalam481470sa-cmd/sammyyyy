import { useMemo } from 'react'
import { History, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { loadDemoChangeHistory } from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'

export function SecurityPage() {
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)

  const changes = useMemo(() => loadDemoChangeHistory(owner).slice(0, 80), [owner])

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">Security</h1>
        <p className="mt-1 text-sm text-ink-muted">
          This browser signs the session to your email. Sign out ends the session and keeps every
          CRM edit in your vault.
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-6 py-6 lg:grid-cols-2 lg:px-8">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">This session</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Signed in
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{user?.name ?? '—'}</dd>
              <dd className="text-xs text-ink-muted">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Vault
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] text-ink-muted">{owner}</dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-ink-muted">
            <li>Each login issues a random session token signed on this device.</li>
            <li>Another email cannot open this vault. Tampered session proofs are rejected.</li>
            <li>Sign out clears the session only — opportunities, tasks, and documents stay.</li>
            <li>Repeated failed sign-ins are throttled. CSP blocks unexpected scripts.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card) lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">Change history</h2>
          </div>
          <ul className="divide-y divide-border">
            {changes.length === 0 && (
              <li className="py-3 text-sm text-ink-muted">No changes recorded for this account yet.</li>
            )}
            {changes.map((chg, index) => (
              <li key={`${chg.resourceId}-${chg.createdAt}-${index}`} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    <span className="font-semibold">{chg.actorName ?? 'System'}</span> — {chg.changeType}{' '}
                    {chg.resourceType}
                    <span className="text-ink-muted"> · {chg.resourceId}</span>
                  </p>
                  <span className="text-[11px] text-ink-subtle">{chg.createdAt}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
