import { ArrowRight, FilePenLine, FileUp, MessageSquare, RefreshCw } from "lucide-react"
import type { ActivityItem, ActivityKind } from "../../types/crm.ts"
import { useCrm } from "../../context/useCrm.ts"
import { formatRelativeTime } from "../../lib/format.ts"

const ICONS: Record<ActivityKind, typeof ArrowRight> = {
  stage: ArrowRight,
  note: MessageSquare,
  document: FileUp,
  status: RefreshCw,
  terms: FilePenLine,
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const { snapshot, openOpportunity } = useCrm()

  return (
    <section className="card flex h-full flex-col p-5" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-[15px] font-semibold tracking-tight text-ink">
        Recent Activity
      </h2>
      <p className="mt-1 text-sm text-muted">Movement across the acquisition team.</p>
      {items.length === 0 ? (
        <p className="py-8 text-sm text-muted">No recent activity in this view.</p>
      ) : (
        <ul className="mt-3">
          {items.map((item) => {
            const Icon = ICONS[item.kind]
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openOpportunity(item.projectId)}
                  className="flex w-full gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-canvas"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-navy-700">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm text-ink">{item.message}</span>
                    <span className="mt-0.5 block text-xs text-muted">{formatRelativeTime(item.occurredAt, snapshot.asOf)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
