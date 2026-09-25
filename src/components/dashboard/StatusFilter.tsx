import React from 'react'
import { OpportunityStatus } from '../../types/crm'
import { OPPORTUNITY_STATUSES, STATUS_CONFIG } from '../../types/constants'
import { RotateCcw } from 'lucide-react'

interface StatusFilterProps {
  selectedStatus: OpportunityStatus | 'All Deals'
  onSelectStatus: (status: OpportunityStatus | 'All Deals') => void
  statusCounts: Record<OpportunityStatus | 'All Deals', number>
  activeStageFilter?: string | null
  onClearAllFilters?: () => void
  needsAttentionFilterActive?: boolean
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  selectedStatus,
  onSelectStatus,
  statusCounts,
  activeStageFilter,
  onClearAllFilters,
  needsAttentionFilterActive
}) => {
  const isFiltered = selectedStatus !== 'All Deals' || Boolean(activeStageFilter) || needsAttentionFilterActive

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-200/60">
      <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-full">
        {/* All Deals button */}
        <button
          onClick={() => onSelectStatus('All Deals')}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selectedStatus === 'All Deals' && !needsAttentionFilterActive
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span>All Deals</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
              selectedStatus === 'All Deals' && !needsAttentionFilterActive
                ? 'bg-slate-700 text-slate-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusCounts['All Deals'] ?? 0}
          </span>
        </button>

        {/* Status Option Tabs */}
        {OPPORTUNITY_STATUSES.map((status) => {
          const isSelected = selectedStatus === status && !needsAttentionFilterActive
          const count = statusCounts[status] || 0
          const config = STATUS_CONFIG[status]

          return (
            <button
              key={status}
              onClick={() => onSelectStatus(status)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : config?.dotClass || 'bg-slate-400'}`} />
              <span>{status}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter indicator & Clear action */}
      {isFiltered && (
        <div className="flex items-center space-x-2">
          {activeStageFilter && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Stage: <strong className="ml-1 font-semibold">{activeStageFilter}</strong>
            </span>
          )}
          {needsAttentionFilterActive && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Filtering: <strong className="ml-1 font-semibold">Needs Attention</strong>
            </span>
          )}
          {onClearAllFilters && (
            <button
              onClick={onClearAllFilters}
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-blue-600 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
