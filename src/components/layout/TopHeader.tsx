import React from 'react'
import {
  Search,
  Bell,
  Plus,
  X,
  SlidersHorizontal
} from 'lucide-react'

interface TopHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onNewOpportunity: () => void
  alertCount?: number
  onToggleAlerts?: () => void
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewOpportunity,
  alertCount = 3,
  onToggleAlerts
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/90 shadow-subtle px-6 py-3.5 transition-all">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Title & Subtitle */}
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Good afternoon, Mary
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
              Executive M&A View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Here's what's happening across Newport's acquisition pipeline.
          </p>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center space-x-3">
          {/* Global Search */}
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects, companies, contacts..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Notification Button */}
          <button
            onClick={onToggleAlerts}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Pipeline Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {alertCount}
              </span>
            )}
          </button>

          {/* Quick Filter toggle indicator */}
          <div className="hidden lg:flex items-center text-xs text-slate-400 pl-1">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
            <span className="text-[11px]">Q3 2026</span>
          </div>

          {/* "+ New Opportunity" Button */}
          <button
            onClick={onNewOpportunity}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Opportunity</span>
          </button>

          {/* User Profile */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center ring-2 ring-slate-100 shadow-sm">
              MS
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">Mary Sbaschnig</span>
              <span className="text-[10px] text-slate-500 leading-tight">Managing Director</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
