import { ChevronRight } from 'lucide-react'
import { STAGES, type StageId } from '../../config/picklists'
import type { EnrichedOpportunity } from '../../types'
import { formatMoney } from '../../lib/format'
import { Card } from '../common/Card'

interface PipelineOverviewProps {
  /** Opportunities matching the current status/search/attention filters (stage-agnostic). */
  opportunities: EnrichedOpportunity[]
  selectedStage: StageId | null
  onSelectStage: (stage: StageId | null) => void
}

/**
 * Horizontal stage visualization of the acquisition process.
 * Clicking a stage filters the Priority Deals table below.
 */
export function PipelineOverview({
  opportunities,
  selectedStage,
  onSelectStage,
}: PipelineOverviewProps) {
  const byStage = STAGES.map((stage) => {
    const deals = opportunities.filter((o) => o.stage === stage.id)
    return {
      ...stage,
      count: deals.length,
      nwp: deals.reduce((sum, o) => sum + o.nwp, 0),
    }
  })

  return (
    <Card
      title="Acquisition Pipeline"
      subtitle="Deals by acquisition stage — select a stage to filter the table below"
      actions={
        selectedStage && (
          <button
            type="button"
            onClick={() => onSelectStage(null)}
            className="text-xs font-medium text-navy-600 hover:text-navy-800"
          >
            Show all stages
          </button>
        )
      }
    >
      <div className="-mx-1 overflow-x-auto pb-1">
        <ol className="flex min-w-[900px] items-stretch gap-1 px-1">
          {byStage.map((stage, index) => {
            const selected = selectedStage === stage.id
            const empty = stage.count === 0
            return (
              <li key={stage.id} className="flex min-w-0 flex-1 items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => onSelectStage(selected ? null : stage.id)}
                  aria-pressed={selected}
                  className={`flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-3 text-left transition-all ${
                    selected
                      ? 'border-navy-600 bg-navy-900 shadow-md'
                      : empty
                        ? 'border-slate-100 bg-slate-50/60 hover:border-slate-200'
                        : 'border-slate-200 bg-white hover:border-navy-300 hover:shadow-sm'
                  }`}
                >
                  <span
                    className={`h-1 w-full rounded-full ${
                      selected ? 'bg-accent-400' : empty ? 'bg-slate-200' : 'bg-navy-200'
                    }`}
                    style={
                      !selected && !empty
                        ? {
                            backgroundColor: `color-mix(in srgb, var(--color-navy-800) ${
                              25 + (index / (byStage.length - 1)) * 75
                            }%, var(--color-navy-100))`,
                          }
                        : undefined
                    }
                  />
                  <span
                    className={`mt-2.5 line-clamp-2 text-[11px] font-semibold leading-tight ${
                      selected ? 'text-white' : empty ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span
                    className={`mt-1.5 text-xl font-semibold tracking-tight ${
                      selected ? 'text-white' : empty ? 'text-slate-300' : 'text-navy-900'
                    }`}
                  >
                    {stage.count}
                  </span>
                  <span
                    className={`mt-0.5 text-[11px] ${
                      selected ? 'text-navy-200' : 'text-slate-400'
                    }`}
                  >
                    {stage.count > 0 ? `${formatMoney(stage.nwp)} NWP` : '—'}
                  </span>
                </button>
                {index < byStage.length - 1 && (
                  <span className="flex items-center text-slate-300">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}
