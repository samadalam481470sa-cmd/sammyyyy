import {
  stageLabel,
  statusLabel,
  type StageId,
  type StatusId,
  type TaskPriorityId,
  TASK_PRIORITIES,
} from '../../config/picklists'

/**
 * Restrained badge styling per status. Status and stage are rendered by
 * distinct components to reinforce that they are separate concepts.
 */
const STATUS_STYLES: Record<StatusId, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  declined: 'bg-rose-50 text-rose-700 ring-rose-200',
  withdrew: 'bg-slate-100 text-slate-600 ring-slate-200',
  completed: 'bg-navy-50 text-navy-700 ring-navy-200',
}

export function StatusBadge({ status }: { status: StatusId }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}

export function StageBadge({ stage }: { stage: StageId }) {
  return (
    <span className="inline-flex items-center rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700 ring-1 ring-inset ring-navy-100">
      {stageLabel(stage)}
    </span>
  )
}

const PRIORITY_STYLES: Record<TaskPriorityId, string> = {
  A: 'bg-navy-900 text-white',
  B: 'bg-navy-100 text-navy-800',
  C: 'bg-slate-100 text-slate-500',
}

export function PriorityBadge({ priority }: { priority: TaskPriorityId }) {
  const meta = TASK_PRIORITIES.find((p) => p.id === priority)
  return (
    <span
      title={meta?.label}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  )
}
