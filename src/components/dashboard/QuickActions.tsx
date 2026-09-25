import React from 'react'
import {
  Plus,
  CheckSquare,
  FileSpreadsheet,
  FilePlus2
} from 'lucide-react'

interface QuickActionsProps {
  onNewOpportunity: () => void
  onAddTask: () => void
  onLogActivity: () => void
  onImportExcel: () => void
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewOpportunity,
  onAddTask,
  onLogActivity,
  onImportExcel,
}) => {
  return (
    <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md shadow-slate-900/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Quick Actions
          </h3>
          <span className="text-[10px] text-blue-400 font-medium">Pipeline Ops</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Execute common deal intake, task creation, and diligence logging actions
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onNewOpportunity}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Opportunity</span>
        </button>

        <button
          onClick={onAddTask}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium rounded-lg transition-all"
        >
          <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
          <span>Add Task</span>
        </button>

        <button
          onClick={onLogActivity}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium rounded-lg transition-all"
        >
          <FilePlus2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Log Activity</span>
        </button>

        <button
          onClick={onImportExcel}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium rounded-lg transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Import Excel</span>
        </button>
      </div>
    </div>
  )
}
