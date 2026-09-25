import React from 'react'
import { Opportunity, OpportunityStage } from '../../types/crm'
import { ACQUISITION_STAGES } from '../../types/constants'
import { formatCurrency } from '../../utils/formatters'
import { ChevronRight, Filter } from 'lucide-react'

interface AcquisitionPipelineProps {
  opportunities: Opportunity[]
  selectedStage: string | null
  onSelectStage: (stage: OpportunityStage | null) => void
}

export const AcquisitionPipeline: React.FC<AcquisitionPipelineProps> = ({
  opportunities,
  selectedStage,
  onSelectStage,
}) => {
  // Group active/relevant deals by stage
  const stageStats = ACQUISITION_STAGES.map((stage) => {
    // Only count active deals in the acquisition pipeline stage overview (as per PE pipeline standards)
    const stageDeals = opportunities.filter((o) => o.stage === stage && o.status === 'Active')
    const count = stageDeals.length
    const totalNwp = stageDeals.reduce((sum, o) => sum + o.nwp, 0)
    const totalEbitda = stageDeals.reduce((sum, o) => sum + o.pfEbitda, 0)

    return {
      stage,
      count,
      totalNwp,
      totalEbitda,
      deals: stageDeals
    }
  })

  const totalActivePipelineNwp = stageStats.reduce((sum, s) => sum + s.totalNwp, 0)
  const totalActiveDeals = stageStats.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-subtle">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Acquisition Pipeline
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalActiveDeals} Active Targets
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active acquisition stages from target discovery through closing diligence ({formatCurrency(totalActivePipelineNwp)} Total Active NWP)
          </p>
        </div>

        {selectedStage && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Filtered by: <strong className="text-blue-700 ml-1">{selectedStage}</strong>
            </span>
            <button
              onClick={() => onSelectStage(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
            >
              Reset Stage
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Pipeline Stages */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {stageStats.map((item, idx) => {
          const isSelected = selectedStage === item.stage
          const hasDeals = item.count > 0

          return (
            <button
              key={item.stage}
              onClick={() => onSelectStage(isSelected ? null : item.stage)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 relative group ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/30 shadow-sm'
                  : hasDeals
                  ? 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200 hover:border-slate-300'
                  : 'bg-white hover:bg-slate-50/50 border-slate-200/60 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Step indicator & stage order */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : hasDeals
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </span>

                {item.count > 0 && (
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {item.count} {item.count === 1 ? 'deal' : 'deals'}
                  </span>
                )}
              </div>

              {/* Stage Name */}
              <div className="text-xs font-semibold text-slate-800 leading-tight mb-2 min-h-[32px] flex items-center">
                {item.stage}
              </div>

              {/* Aggregate Financials */}
              <div className="mt-auto pt-2 border-t border-slate-200/60">
                {item.count > 0 ? (
                  <div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      {formatCurrency(item.totalNwp)}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      NWP ({formatCurrency(item.totalEbitda)} EBITDA)
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">No active</span>
                )}
              </div>

              {/* Connected arrow for flow visual (except last) */}
              {idx < stageStats.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 pointer-events-none group-hover:text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
