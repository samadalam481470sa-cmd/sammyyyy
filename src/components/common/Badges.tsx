import {
  stageLabel,
  statusLabel,
  type StageId,
  type StatusId,
  type TaskPriorityId,
  TASK_PRIORITIES,
} from '../../config/picklists'

/** Salesforce Lightning badge colors. Status and stage stay visually distinct. */
const STATUS_STYLES: Record<StatusId, string> = {
  active: 'bg-[#cdefc4] text-[#194e31]',
  pending: 'bg-[#f9e3b6] text-[#5c3404]',
  inactive: 'bg-[#ecebea] text-[#444444]',
  closed: 'bg-[#ecebea] text-[#444444]',
  declined: 'bg-[#fddde3] text-[#8e030f]',
  withdrew: 'bg-[#ecebea] text-[#444444]',
  completed: 'bg-brand-100 text-brand-700',
}

export function StatusBadge({ status }: { status: StatusId }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  )
}

export function StageBadge({ stage }: { stage: StageId }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
      {stageLabel(stage)}
    </span>
  )
}

const PRIORITY_STYLES: Record<TaskPriorityId, string> = {
  A: 'bg-brand-500 text-white',
  B: 'bg-hub-500 text-white',
  C: 'bg-[#ecebea] text-[#444444]',
}

export function PriorityBadge({ priority }: { priority: TaskPriorityId }) {
  const meta = TASK_PRIORITIES.find((p) => p.id === priority)
  return (
    <span
      title={meta?.label}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-[3px] text-[11px] font-bold ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  )
}
