import { ListPlus, Plus, UserCheck, UserPlus } from 'lucide-react'

interface QuickActionsProps {
  onAction: (action: string) => void
  /** New Deal Lead for admins; Add Myself as Deal Lead or Edit My Deal Lead Profile for everyone else. */
  leadLabel: string
}

const ACTIONS = [
  { id: 'new-opportunity', label: 'New Opportunity', icon: Plus },
  { id: 'add-task', label: 'Add Task', icon: ListPlus },
  { id: 'new-relationship', label: 'New Relationship', icon: UserPlus },
] as const

export function QuickActions({ onAction, leadLabel }: QuickActionsProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
      <h2 className="font-brand text-lg font-bold text-navy-900">Quick Actions</h2>
      <p className="mt-0.5 mb-4 text-sm text-ink-muted">
        Add records and jump into core workflows
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[...ACTIONS, { id: 'deal-lead', label: leadLabel, icon: UserCheck }].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`quick-action-${id}`}
            onClick={() => onAction(id)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:border-accent-muted hover:bg-accent-soft"
          >
            <Icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
