import { OPPORTUNITY_STATUSES, type StatusFilter as StatusFilterValue } from "../../types/crm.ts"
import { useCrm } from "../../context/useCrm.ts"
import { cn } from "../../lib/cn.ts"

const OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: "All", label: "All Deals" },
  ...OPPORTUNITY_STATUSES.map((status) => ({ value: status, label: status })),
]

export function StatusFilter({ summary }: { summary: string | null }) {
  const { filters, setStatus, clearFilters, hasActiveFilters } = useCrm()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="group" aria-label="Deal status">
          {OPTIONS.map((option) => {
            const selected = filters.status === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  selected ? "bg-navy-900 text-white" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="ml-auto text-sm font-semibold text-navy-700 disabled:cursor-default disabled:text-muted/60"
        >
          Clear filters
        </button>
      </div>
      {summary ? <p className="text-sm text-muted">{summary}</p> : null}
    </div>
  )
}
