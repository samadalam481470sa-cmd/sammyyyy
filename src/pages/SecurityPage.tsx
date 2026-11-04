import { useMemo, useRef, useState } from 'react'
import { paginate } from '@/lib/paginate'
import { Pagination } from '@/components/shared/Pagination'
import { History, Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { loadDemoChangeHistory } from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { PageShell, PageTitleBar } from '@/components/shared/PageChrome'
import { useFitRows } from '@/hooks/useFitRows'

export function SecurityPage() {
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)
  const changes = useMemo(() => loadDemoChangeHistory(owner), [owner])
  const [page, setPage] = useState(1)
  const listRef = useRef<HTMLUListElement>(null)
  // The history region has a fixed height; rows that fit decide the page size, so the page never scrolls.
  const pageSize = useFitRows(listRef, { rowHeight: 41, headerHeight: 0, min: 4, rowSelector: 'li' })
  const view = paginate(changes, page, pageSize)

  return (
    <PageShell testId="security-page">
      <PageTitleBar title="Security" subtitle="This browser signs the session to your email. Sign out ends the session and keeps every CRM edit in your vault." />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:overflow-hidden lg:px-8">
        <section className="h-fit rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">This session</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">Signed in</dt>
              <dd className="mt-0.5 font-medium text-ink">{user?.name ?? '—'}</dd>
              <dd className="text-xs text-ink-muted">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">Vault</dt>
              <dd className="mt-0.5 font-mono text-[11px] break-all text-ink-muted">{owner}</dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-ink-muted">
            <li>Each login issues a random session token signed on this device.</li>
            <li>Another email cannot open this vault. Tampered session proofs are rejected.</li>
            <li>Sign out clears the session only — opportunities, tasks, and documents stay.</li>
            <li>Repeated failed sign-ins are throttled. CSP blocks unexpected scripts.</li>
            <li>These protections are browser-level. They are not a substitute for server-side security.</li>
          </ul>
        </section>

        <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:min-h-0" data-testid="security-history">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent" />
              <h2 className="font-brand text-lg font-bold text-navy-900">Change history</h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
              <Lock className="h-3.5 w-3.5" /> Protected record: archiving Recent Activity never removes entries here
            </span>
          </div>
          <ul ref={listRef} className="min-h-0 flex-1 divide-y divide-border overflow-hidden px-5">
            {changes.length === 0 && <li className="py-3 text-sm text-ink-muted">No changes recorded for this account yet.</li>}
            {view.rows.map((chg, index) => (
              <li key={`${chg.resourceId}-${chg.createdAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <p className="min-w-0 truncate text-sm font-medium text-ink">
                  <span className="font-semibold">{chg.actorName ?? 'System'}</span> — {chg.changeType} {chg.resourceType}
                  <span className="text-ink-muted"> · {chg.resourceId}</span>
                </p>
                <span className="text-[11px] text-ink-subtle">{new Date(chg.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <Pagination {...view} onPage={setPage} noun="changes" testId="security-history-pagination" />
        </section>
      </div>
    </PageShell>
  )
}
