import type { PipelineStageSummary } from "../../lib/dashboardModel.ts"
import { formatCompactCurrency } from "../../lib/format.ts"
import { cn } from "../../lib/cn.ts"
import { useCrm } from "../../context/useCrm.ts"
import type { AcquisitionStage } from "../../types/crm.ts"

export function PipelineOverview({
  stages,
  subtitle,
}: {
  stages: PipelineStageSummary[]
  subtitle: string
}) {
  const { filters, selectStage } = useCrm()

  return (
    <section className="card p-5" aria-labelledby="pipeline-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pipeline-heading" className="text-[15px] font-semibold tracking-tight text-ink">
            Acquisition Pipeline
          </h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {filters.stage ? (
          <button type="button" onClick={() => selectStage(filters.stage as AcquisitionStage)} className="text-sm font-semibold text-navy-700">
            Clear stage
          </button>
        ) : null}
      </div>

      <div className="scroll-thin mt-5 overflow-x-auto pb-1">
        <div className="relative min-w-[1040px]">
          <div className="absolute top-7 right-[6%] left-[6%] h-px bg-navy-800/15" />
          <ol className="relative grid grid-cols-9 gap-1.5">
            {stages.map((stage) => {
              const selected = filters.stage === stage.stage
              return (
                <li key={stage.stage}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectStage(stage.stage)}
                    className={cn(
                      "flex w-full flex-col items-center rounded-xl px-2 py-3 text-center",
                      selected ? "bg-navy-900 text-white" : "hover:bg-canvas",
                    )}
                  >
                    <span
                      className={cn(
                        "z-10 flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums",
                        selected ? "bg-white text-navy-900" : "bg-white text-navy-800 ring-1 ring-line",
                      )}
                    >
                      {stage.count}
                    </span>
                    <span className="mt-3 min-h-8 text-xs leading-tight font-semibold">{stage.stage}</span>
                    <span className={cn("mt-1 text-[11px] tabular-nums", selected ? "text-white/75" : "text-muted")}>
                      {stage.count === 0 ? "—" : `${formatCompactCurrency(stage.nwp)} NWP`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
