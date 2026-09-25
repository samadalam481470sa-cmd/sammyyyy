import type { PriorityTask } from '../../types'
import { formatDate } from '../../lib/format'
import { Card } from '../common/Card'
import { PriorityBadge } from '../common/Badges'

interface PriorityTasksProps {
  tasks: PriorityTask[]
}

export function PriorityTasks({ tasks }: PriorityTasksProps) {
  return (
    <Card title="This Week's Priorities" subtitle="A — must move · B — important · C — monitor" flush>
      <ul className="divide-y divide-line">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
            <PriorityBadge priority={task.priority} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug font-medium text-ink">{task.action}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                <span className="font-semibold text-brand-500">{task.projectName}</span>
                {' · '}
                {task.owner}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-muted">
              {formatDate(task.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
