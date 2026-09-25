import { FileSpreadsheet, ListChecks, NotebookPen, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  toast: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-opportunity',
    label: 'New Opportunity',
    icon: Plus,
    toast: 'Opportunity intake ships with the Opportunities module.',
  },
  {
    id: 'add-task',
    label: 'Add Task',
    icon: ListChecks,
    toast: 'Task creation ships with the Tasks & Follow-Ups module.',
  },
  {
    id: 'log-activity',
    label: 'Log Activity',
    icon: NotebookPen,
    toast: 'Activity logging ships with the Opportunity profile.',
  },
  {
    id: 'import-excel',
    label: 'Import Excel',
    icon: FileSpreadsheet,
    toast: 'Excel import will migrate the existing pipeline tracker.',
  },
];

export function QuickActions() {
  const { notify } = useToast();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Quick actions
      </span>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            size="sm"
            variant="secondary"
            icon={<Icon className="size-3.5 text-slate-500" />}
            onClick={() => notify(action.label, action.toast)}
          >
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
