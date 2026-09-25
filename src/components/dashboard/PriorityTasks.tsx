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
      <ul className="divide-y divide-slate-50">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-3 px-5 py-3">
            <PriorityBadge priority={task.priority} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-slate-800">{task.action}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                <span className="font-medium text-navy-600">{task.projectName}</span>
                {' · '}
                {task.owner}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-slate-500">
              {formatDate(task.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
