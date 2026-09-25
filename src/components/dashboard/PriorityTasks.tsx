import clsx from 'clsx';
import { CalendarCheck, ListChecks } from 'lucide-react';
import { PRIORITY_LEVELS } from '../../config/picklists';
import { formatDateShort, formatDueLabel } from '../../lib/format';
import type { OpportunityView, TaskItem } from '../../types';
import { PriorityBadge } from '../ui/Badge';
import { Card, CardFooter, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface PriorityTasksProps {
  tasks: TaskItem[];
  opportunitiesById: Map<string, OpportunityView>;
  onSelectOpportunity: (opportunity: OpportunityView) => void;
}

const DUE_TONE_STYLES = {
  overdue: 'text-rose-600',
  today: 'text-amber-700',
  soon: 'text-slate-500',
  scheduled: 'text-slate-400',
  none: 'text-slate-400',
} as const;

export function PriorityTasks({ tasks, opportunitiesById, onSelectOpportunity }: PriorityTasksProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="This Week's Priorities"
        icon={<ListChecks className="size-4" />}
        subtitle="Newport A / B / C working priorities"
      />

      {tasks.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-5" />} title="No priorities scheduled" />
      ) : (
        <ul className="flex-1 divide-y divide-slate-100">
          {tasks.map((task) => {
            const opportunity = opportunitiesById.get(task.opportunityId);
            const due = formatDueLabel(task.dueDate);

            return (
              <li key={task.id}>
                <button
                  type="button"
                  disabled={!opportunity}
                  onClick={() => opportunity && onSelectOpportunity(opportunity)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-navy-50/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="pt-0.5">
                    <PriorityBadge priority={task.priority} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-navy-900">
                      {task.action}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {opportunity?.projectName ?? 'Unlinked'}
                      <span className="mx-1.5 text-slate-300">|</span>
                      {task.owner}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="numeric block text-xs text-slate-600">
                      {formatDateShort(task.dueDate)}
                    </span>
                    <span className={clsx('block text-[11px]', DUE_TONE_STYLES[due.tone])}>
                      {due.text}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {PRIORITY_LEVELS.map((level) => (
          <span key={level.id} className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-navy-800">{level.label}</span>
            {level.description}
          </span>
        ))}
      </CardFooter>
    </Card>
  );
}
