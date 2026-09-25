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
        {ACTIONS.map((action, index) => {
          const Icon = action.icon
          const primary = index === 0
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.label)}
              className={`flex items-center gap-2 rounded-[4px] border px-3 py-2 text-[12px] font-semibold transition-colors ${
                primary
                  ? 'border-hub-500 bg-hub-500 text-white hover:bg-hub-600'
                  : 'border-[#c9c9c9] bg-white text-brand-700 hover:bg-canvas'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
