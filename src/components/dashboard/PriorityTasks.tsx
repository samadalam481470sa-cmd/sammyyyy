import { CalendarClock } from 'lucide-react';
import type { PriorityTask } from '../../types/opportunity';
import { formatNextActionDate } from '../../lib/dateUtils';
import PriorityBadge from '../common/PriorityBadge';

interface PriorityTasksProps {
  tasks: PriorityTask[];
}

export default function PriorityTasks({ tasks }: PriorityTasksProps) {
  return (
    <section className="card-shadow flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <CalendarClock size={17} className="text-navy-600" />
        <h2 className="text-base font-semibold text-navy-900">This Week&apos;s Priorities</h2>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">What the deal team needs to move forward</p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <PriorityBadge priority={task.priority} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-900">{task.action}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span className="font-medium text-accent-700">{task.projectName}</span>
                <span className="text-slate-300">&middot;</span>
                <span>{task.owner}</span>
                <span className="text-slate-300">&middot;</span>
                <span>Due {formatNextActionDate(task.dueDate)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
