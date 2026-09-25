import { FilterX } from 'lucide-react'
import { STATUSES, type StatusId } from '../../config/picklists'

interface StatusFilterProps {
  value: StatusId | 'all'
  counts: Record<string, number>
  showClear: boolean
  onChange: (status: StatusId | 'all') => void
  onClear: () => void
}

/** Global status filter — status is the broad deal condition, distinct from stage. */
export function StatusFilter({ value, counts, showClear, onChange, onClear }: StatusFilterProps) {
  const options: { id: StatusId | 'all'; label: string }[] = [
    { id: 'all', label: 'All Deals' },
    ...STATUSES.map((s) => ({ id: s.id, label: s.label })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {options.map((option) => {
          const active = value === option.id
          const count = option.id === 'all' ? undefined : counts[option.id]
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
              {count !== undefined && count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold ${
                    active ? 'bg-navy-700 text-navy-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-navy-800"
        >
          <FilterX className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      )}
    </div>
  )
}
