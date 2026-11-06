import { AlertTriangle, CheckCircle2, CloudOff, Loader2, X } from 'lucide-react'
import { useData } from '@/data/DataContext'

/** Says plainly whether other people can see this person's work right now. */
export function SyncStatusChip() {
  const { sync } = useData()
  const view = {
    local: { label: 'This device only', title: 'No shared server is connected. Changes stay in this browser.', tone: 'text-ink-muted', Icon: CloudOff },
    connecting: { label: 'Connecting…', title: 'Loading the shared records.', tone: 'text-ink-muted', Icon: Loader2 },
    saving: { label: 'Saving…', title: 'Sending changes to the server.', tone: 'text-ink-muted', Icon: Loader2 },
    synced: { label: 'Shared', title: `All changes are on the server. Other people's changes arrive within 10 seconds.${sync.lastSyncedAt ? ` Last checked ${new Date(sync.lastSyncedAt).toLocaleTimeString()}.` : ''}`, tone: 'text-success', Icon: CheckCircle2 },
    failed: { label: 'Not synced', title: sync.message ?? 'The server cannot be reached. Changes are not shared yet.', tone: 'text-attention', Icon: AlertTriangle },
  }[sync.state]
  const { Icon } = view
  return (
    <span className={`inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold ${view.tone}`} title={view.title} data-testid="sync-status" data-state={sync.state} role="status">
      <Icon className={`h-3.5 w-3.5 ${sync.state === 'saving' || sync.state === 'connecting' ? 'animate-spin' : ''}`} />
      {view.label}
    </span>
  )
}

/** A save that met someone else's save. It stays until it is read. */
export function ConflictNotices() {
  const { sync, dismissConflict } = useData()
  if (!sync.conflicts.length && sync.state !== 'failed') return null
  return (
    <div className="pointer-events-none fixed top-3 left-1/2 z-[90] flex w-full max-w-lg -translate-x-1/2 flex-col gap-2 px-4" data-testid="conflict-notices">
      {sync.state === 'failed' && sync.message && (
        <div role="alert" className="rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-xs font-medium text-attention shadow-(--shadow-card)" data-testid="sync-failed-banner">
          {sync.message}
        </div>
      )}
      {sync.conflicts.map((notice) => (
        <div key={notice.id} role="alert" className="pointer-events-auto flex items-start gap-2 rounded-lg border border-[#f0e2bd] bg-[#fdf7e7] px-3 py-2 text-xs text-[#7a5c1e] shadow-(--shadow-card)" data-testid="conflict-notice">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{notice.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismissConflict(notice.id)} className="rounded p-0.5 hover:bg-black/5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
