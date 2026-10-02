import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PriorityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ModuleSearch } from '../components/ui/ModuleSearch';
import { PageHeader } from '../components/ui/PageHeader';
import { useDashboard } from '../hooks/useDashboard';
import { formatDateShort, formatDueLabel } from '../lib/format';

export function TasksPage() {
  const { snapshot, opportunitiesById, openModal } = useDashboard();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const tasks = snapshot?.tasks ?? [];

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...tasks]
      .filter((task) => {
        if (priority !== 'all' && task.priority !== priority) return false;
        if (!query) return true;
        const project = opportunitiesById.get(task.opportunityId)?.projectName ?? '';
        return [task.action, task.owner, project].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => a.priority.localeCompare(b.priority) || a.dueDate.localeCompare(b.dueDate));
  }, [tasks, search, priority, opportunitiesById]);

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <PageHeader
        title="Tasks & Follow-Ups"
        subtitle="A / B / C working list across the acquisition team."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openModal('task')}>
            Add Task
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ModuleSearch value={search} onChange={setSearch} placeholder="Search tasks, owners, projects..." />
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(['all', 'A', 'B', 'C'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                priority === value ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {value === 'all' ? 'All' : `Priority ${value}`}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="divide-y divide-slate-100">
          {rows.map((task) => {
            const due = formatDueLabel(task.dueDate);
            const project = opportunitiesById.get(task.opportunityId);
            return (
              <div key={task.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <PriorityBadge priority={task.priority} />
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{task.action}</p>
                    <p className="text-xs text-slate-500">
                      {project?.projectName ?? 'Unknown project'} · {task.owner}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="numeric text-navy-900">{formatDateShort(task.dueDate)}</p>
                  <p className={`text-xs ${due.tone === 'overdue' ? 'text-rose-600' : 'text-slate-500'}`}>
                    {due.text}
                  </p>
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No tasks match the current filters.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
