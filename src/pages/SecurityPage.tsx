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
          Microsoft 365 is the only sign-in method. Managerial keys and API-key slots are retired.
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-6 py-6 lg:grid-cols-2 lg:px-8">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">Microsoft 365 session</h2>
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
                Auth method
              </dt>
              <dd className="mt-0.5 text-ink">Microsoft 365</dd>
            </div>
          </dl>
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
