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

const ARROW = 18
/** How far each stage tucks under the previous one. Less than ARROW, so a chevron-shaped gap stays visible. */
const OVERLAP = 8

/** Salesforce Path chevron. The first stage is flat on the left; the last is flat on the right. */
function chevronClip(index: number, last: number): string {
  if (index === 0) {
    return `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%)`
  }
  if (index === last) {
    return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${ARROW}px 50%)`
  }
  return `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%, ${ARROW}px 50%)`
}

/**
 * Acquisition stages drawn as a Salesforce-style path.
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
  const last = byStage.length - 1

  return (
    <Card
      title="Acquisition Pipeline"
      subtitle="Select a stage to filter the deals below"
      actions={
        selectedStage && (
          <button
            type="button"
            onClick={() => onSelectStage(null)}
            className="text-xs font-semibold text-brand-500 hover:text-brand-700 hover:underline"
          >
            Show all stages
          </button>
        )
      }
    >
      <div className="-mx-1 overflow-x-auto pb-1">
        <ol className="flex min-w-[1080px] items-stretch px-1">
          {byStage.map((stage, index) => {
            const selected = selectedStage === stage.id
            const empty = stage.count === 0
            return (
              <li
                key={stage.id}
                className="relative min-w-0 flex-1"
                style={{ marginLeft: index === 0 ? 0 : -OVERLAP, zIndex: last - index + 1 }}
              >
                <button
                  type="button"
                  onClick={() => onSelectStage(selected ? null : stage.id)}
                  aria-pressed={selected}
                  style={{ clipPath: chevronClip(index, last) }}
                  className={`flex h-[78px] w-full flex-col justify-center text-left transition-[filter] hover:brightness-95 ${
                    selected
                      ? 'bg-brand-500 text-white'
                      : empty
                        ? 'bg-[#ecebea] text-muted'
                        : 'bg-brand-100 text-brand-900'
                  }`}
                >
                  <span
                    className="block"
                    style={{ paddingLeft: index === 0 ? 12 : ARROW + 8, paddingRight: ARROW + 6 }}
                  >
                    <span className="line-clamp-2 text-[10px] leading-tight font-bold tracking-wide uppercase">
                      {stage.label}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-lg leading-none font-bold">{stage.count}</span>
                      <span className={`text-[10px] ${selected ? 'text-white/80' : 'opacity-70'}`}>
                        {stage.count > 0 ? `${formatMoney(stage.nwp)} NWP` : '—'}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}
