import { ClipboardList, FileUp, Plus, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
}

const ACTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'New Opportunity', label: '+ New Opportunity', icon: Plus },
  { id: 'Add Task', label: 'Add Task', icon: ClipboardList },
  { id: 'Log Activity', label: 'Log Activity', icon: StickyNote },
  { id: 'Import Excel', label: 'Import Excel', icon: FileUp },
];

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <section className="card-shadow rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-navy-900">Quick Actions</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 py-3 text-center transition-colors hover:border-accent-300 hover:bg-accent-50"
          >
            <action.icon size={18} className="text-navy-700" strokeWidth={1.8} />
            <span className="text-xs font-medium text-slate-600">{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
