import { FileSpreadsheet, ListPlus, PenLine, Plus, type LucideIcon } from 'lucide-react'
import { Card } from '../common/Card'

interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
}

const ACTIONS: QuickAction[] = [
  { id: 'new-opportunity', label: 'New Opportunity', icon: Plus },
  { id: 'add-task', label: 'Add Task', icon: ListPlus },
  { id: 'log-activity', label: 'Log Activity', icon: PenLine },
  { id: 'import-excel', label: 'Import Excel', icon: FileSpreadsheet },
]

interface QuickActionsProps {
  onAction: (label: string) => void
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <Card title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.label)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-800"
            >
              <Icon className="h-4 w-4 text-navy-500" />
              {action.label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
