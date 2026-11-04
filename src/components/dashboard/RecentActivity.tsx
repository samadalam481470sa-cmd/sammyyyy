import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ArrowRightLeft, FileUp, MessageSquare, RefreshCw, StickyNote } from 'lucide-react'
import type { ActivityItem } from '@/types'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime } from '@/utils/dashboard'
import { DrawerHeader, SideDrawer } from '@/components/shared/Overlay'
import { PeriodFilterControl } from '@/components/shared/PeriodFilterControl'
import { inPeriod, resolvePeriod, type PeriodFilter } from '@/lib/reports'

interface RecentActivityProps {
  /** Every retained activity record, newest first. */
  allItems: ActivityItem[]
  archived: Set<string>
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onItemClick?: (item: ActivityItem) => void
  historyOpen: boolean
  onOpenHistory: () => void
  onCloseHistory: () => void
}

const TYPE_ICONS: Record<ActivityItem['type'], LucideIcon> = {
  stage_change: ArrowRightLeft,
  note: StickyNote,
  document: FileUp,
  status_change: RefreshCw,
  update: MessageSquare,
  create: FileUp,
  task: StickyNote,
  delete: RefreshCw,
}

function ActivityRow({ item, onItemClick, action }: { item: ActivityItem; onItemClick?: (item: ActivityItem) => void; action?: React.ReactNode }) {
  const Icon = TYPE_ICONS[item.type] ?? MessageSquare
  return (
    <li className="group flex items-start gap-1 pr-3">
      <button type="button" onClick={() => onItemClick?.(item)} className="flex min-w-0 flex-1 gap-3 px-5 py-3 text-left hover:bg-accent-soft/30">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">
            {item.actor ? (
              <>
                <span className="font-semibold">{item.actor}</span> {item.message}
              </>
            ) : (
              item.message
            )}
          </span>
          <span className="mt-0.5 block text-xs text-ink-subtle">
            {formatRelativeTime(item.timestamp)}
            {item.projectName ? ` · ${item.projectName}` : ''}
          </span>
        </span>
      </button>
      {action && <span className="mt-3 shrink-0">{action}</span>}
    </li>
  )
}

/**
 * Recent Activity: the four newest feed entries on the Dashboard; View All opens a drawer with a
 * date filter (default rolling last 30 days) and Archive / Restore. Archive only hides an entry
 * from the feed. The underlying activity and Security change history are never changed or deleted.
 */
export function RecentActivity({ allItems, archived, onArchive, onRestore, onItemClick, historyOpen, onOpenHistory, onCloseHistory }: RecentActivityProps) {
  const [period, setPeriod] = useState<PeriodFilter>({ kind: 'last30' })
  const [showArchived, setShowArchived] = useState(false)
  const feed = useMemo(() => allItems.filter((i) => !archived.has(i.id)), [allItems, archived])
  const resolved = resolvePeriod(period)
  const drawerRows = useMemo(
    () => allItems.filter((i) => inPeriod(i.timestamp, resolved) && (showArchived ? archived.has(i.id) : !archived.has(i.id))),
    [allItems, archived, resolved, showArchived],
  )
  const btn = 'inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-semibold text-ink-muted hover:text-ink'

  return (
    <>
      <section className="rounded-xl border border-border bg-surface shadow-(--shadow-card)" data-testid="recent-activity">
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy-900">Recent Activity</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Saved changes on this device and account.</p>
          </div>
          <button type="button" onClick={onOpenHistory} className="text-xs font-semibold text-accent hover:underline" data-testid="activity-view-all">
            View all
          </button>
        </div>
        <ul className="divide-y divide-border/70">
          {feed.length === 0 && <li className="px-5 py-8 text-sm text-ink-muted">No saved activity yet. Successful saves appear here.</li>}
          {feed.slice(0, 4).map((item) => (
            <ActivityRow key={item.id} item={item} onItemClick={onItemClick} />
          ))}
        </ul>
      </section>

      <SideDrawer open={historyOpen} onRequestClose={onCloseHistory} label="Recent activity" width="max-w-[560px]" testId="activity-drawer">
        <DrawerHeader title="Recent Activity" subtitle="Archive hides an entry from the feed. Records and the security change history are kept." onClose={onCloseHistory} closeLabel="Close activity" />
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <PeriodFilterControl value={period} onChange={setPeriod} allowLast30 testId="activity-period" />
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archived.size})
          </label>
        </div>
        <p className="shrink-0 px-5 pt-2 text-[11px] text-ink-subtle">
          {drawerRows.length} {showArchived ? 'archived ' : ''}entr{drawerRows.length === 1 ? 'y' : 'ies'} · {resolved.label}. Activity from other people’s devices appears here once the shared backend is in place.
        </p>
        <ul className="custom-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {drawerRows.length === 0 && <li className="px-5 py-8 text-sm text-ink-muted">Nothing in this period. Choose All Time to see every retained record.</li>}
          {drawerRows.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              onItemClick={onItemClick}
              action={
                archived.has(item.id) ? (
                  <button type="button" className={btn} onClick={() => onRestore(item.id)} title="Show in the feed again">
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                  </button>
                ) : (
                  <button type="button" className={btn} onClick={() => onArchive(item.id)} title="Hide from the feed (record is kept)" data-testid="archive-activity">
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )
              }
            />
          ))}
        </ul>
      </SideDrawer>
    </>
  )
}
