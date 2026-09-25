import { PRIORITY_LABELS } from "../../data/constants.ts"
import { cn } from "../../lib/cn.ts"
import type { OpportunityStatus, Priority } from "../../types/crm.ts"

const STATUS_PILL_CLASS: Record<OpportunityStatus, string> = {
  Active: "bg-accent-100 text-navy-800",
  Pending: "bg-amber-soft text-amber",
  Inactive: "bg-canvas text-muted",
  Closed: "bg-navy-800/5 text-navy-700",
  Declined: "bg-danger-soft text-danger",
  Withdrew: "bg-canvas text-muted",
  Completed: "bg-positive-soft text-positive",
}

export function StatusPill({ status }: { status: OpportunityStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_PILL_CLASS[status])}>
      {status}
    </span>
  )
}

const PRIORITY_CLASS: Record<Priority, string> = {
  A: "bg-navy-900 text-white",
  B: "bg-white text-navy-800 ring-1 ring-navy-800/25 ring-inset",
  C: "bg-canvas text-muted ring-1 ring-line ring-inset",
}

export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
        PRIORITY_CLASS[priority],
      )}
      title={PRIORITY_LABELS[priority]}
    >
      {priority}
    </span>
  )
}
