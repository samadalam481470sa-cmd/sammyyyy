import React from 'react'
import { PriorityTask } from '../../types/crm'
import { PRIORITY_CONFIG } from '../../types/constants'
import { Clock, AlertCircle } from 'lucide-react'

interface PriorityTasksProps {
  tasks: PriorityTask[]
  onSelectProject: (projectId: string) => void
}

export const PriorityTasks: React.FC<PriorityTasksProps> = ({
  tasks,
  onSelectProject,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle flex flex-col h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              This Week's Priorities
            </h2>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded">
              A/B/C Framework
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Key deliverables to advance live deal execution
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {tasks.length} Active Items
        </span>
      </div>

      {/* Task List */}
      <div className="mt-3 space-y-2.5 flex-1 overflow-y-auto">
        {tasks.map((task) => {
          const config = PRIORITY_CONFIG[task.priority]

          return (
            <div
              key={task.id}
              className="p-3 rounded-lg border border-slate-200/70 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between gap-2">
                {/* Priority Badge & Project */}
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${config.badgeClass}`}
                  >
                    Tier {task.priority}
                  </span>
                  <button
                    onClick={() => onSelectProject(task.projectId)}
                    className="text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors"
                  >
                    {task.project}
                  </button>
                </div>

                {/* Due Date Indicator */}
                <div className="flex items-center space-x-1 flex-shrink-0 text-[10px]">
                  {task.isOverdue ? (
                    <span className="inline-flex items-center text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Due {task.dueDate} (Overdue)
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-slate-500 font-medium">
                      <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      Due {task.dueDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Description */}
              <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                {task.action}
              </p>

              {/* Footer: Owner & Priority Label */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
                  Owner: <strong className="ml-1 text-slate-700 font-semibold">{task.owner}</strong>
                </span>
                <span className="text-slate-400 italic">
                  {config.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
