import { Settings } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { calendarOwnerLabel } from '@/lib/meetingCalendar'
import { sessionOwnerKey } from '@/lib/ownerKey'

export function SettingsPage() {
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Session preferences for this key. Your CRM edits stay on this credential when you sign
          back in.
        </p>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-6 py-6 lg:px-8">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">This session</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Signed in as
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{user?.name ?? '—'}</dd>
              <dd className="text-xs text-ink-muted">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Role
              </dt>
              <dd className="mt-0.5 text-ink">
                {user?.role}
                {user?.isManager ? ' · Managerial master key' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Data vault
              </dt>
              <dd className="mt-0.5 text-ink">{calendarOwnerLabel(user)}</dd>
              <dd className="mt-0.5 font-mono text-[11px] text-ink-muted">{owner}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-muted">
            Opportunities, relationships, tasks, documents, meetings, and calendar notes for this
            key are written locally and restored when you return. Other session keys cannot see
            those edits.
          </p>
        </section>
      </div>
    </div>
  )
}
