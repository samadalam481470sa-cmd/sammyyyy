import {
  ArrowRightLeft,
  FileUp,
  MessageSquare,
  RefreshCw,
  StickyNote,
  X,
} from 'lucide-react'
import type { ActivityItem } from '@/types'
import { formatRelativeTime } from '@/utils/dashboard'
import type { LucideIcon } from 'lucide-react'

interface RecentActivityProps {
  items: ActivityItem[]
  allItems?: ActivityItem[]
  onViewAll?: () => void
  onItemClick?: (item: ActivityItem) => void
  historyOpen?: boolean
  onCloseHistory?: () => void
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

function ActivityRow({
  item,
  onItemClick,
}: {
  item: ActivityItem
  onItemClick?: (item: ActivityItem) => void
}) {
  const Icon = TYPE_ICONS[item.type] ?? MessageSquare
  const clickable = Boolean(onItemClick)
  return (
    <li>
      <button
        type="button"
        onClick={() => onItemClick?.(item)}
        disabled={!clickable}
        className={`flex w-full gap-3 px-5 py-3.5 text-left ${
          clickable ? 'hover:bg-accent-soft/40' : ''
        }`}
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            {item.actor ? (
              <>
                <span className="font-semibold">{item.actor}</span> {item.message}
              </>
            ) : (
              item.message
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-subtle">{formatRelativeTime(item.timestamp)}</p>
        </div>
      </button>
    </li>
  )
}

export function RecentActivity({
  items,
  allItems,
  onViewAll,
  onItemClick,
  historyOpen = false,
  onCloseHistory,
}: RecentActivityProps) {
  const history = allItems ?? items
  return (
    <>
      <section className="rounded-xl border border-border bg-surface shadow-(--shadow-card)">
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy-900">Recent Activity</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Successful saves in this browser. Not synced to other browsers.
            </p>
          </div>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-accent hover:underline"
            >
              View all
            </button>
          )}
        </div>

        <ul className="divide-y divide-border/70">
          {items.length === 0 && (
            <li className="px-5 py-8 text-sm text-ink-muted">
              No saved activity yet in this browser. Successful saves will appear here.
            </li>
          )}
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} onItemClick={onItemClick} />
          ))}
        </ul>
      </section>

      {historyOpen && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/40"
            aria-label="Close activity history"
            onClick={onCloseHistory}
          />
          <aside className="relative flex h-full w-full max-w-lg flex-col bg-surface shadow-(--shadow-drawer)">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-brand text-xl font-bold text-navy-900">Activity history</h2>
                <p className="text-sm text-ink-muted">Newest successful saves first</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
                onClick={onCloseHistory}
                aria-label="Close activity history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="custom-scroll flex-1 divide-y divide-border overflow-y-auto">
              {history.length === 0 && (
                <li className="px-5 py-8 text-sm text-ink-muted">No saved activity yet.</li>
              )}
              {history.map((item) => (
                <ActivityRow key={item.id} item={item} onItemClick={onItemClick} />
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  )
}
