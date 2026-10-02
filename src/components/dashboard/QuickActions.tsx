import { FileSpreadsheet, ListChecks, NotebookPen, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import type { CrmActionModal } from '../../hooks/useDashboardData';
import { Button } from '../ui/Button';

interface QuickAction {
  id: Exclude<CrmActionModal, null>;
  label: string;
  icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'opportunity', label: 'New Opportunity', icon: Plus },
  { id: 'task', label: 'Add Task', icon: ListChecks },
  { id: 'activity', label: 'Log Activity', icon: NotebookPen },
  { id: 'import', label: 'Import Excel', icon: FileSpreadsheet },
];

export function QuickActions() {
  const { openModal } = useDashboard();

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
            onClick={() => openModal(action.id)}
          >
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
