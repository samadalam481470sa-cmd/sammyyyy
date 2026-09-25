import { FilterX } from 'lucide-react'
import { STATUSES, type StatusId } from '../../config/picklists'

interface StatusFilterProps {
  value: StatusId | 'all'
  counts: Record<string, number>
  showClear: boolean
  onChange: (status: StatusId | 'all') => void
  onClear: () => void
}

/** Salesforce button-group filter. Status is the broad deal condition, distinct from stage. */
export function StatusFilter({ value, counts, showClear, onChange, onClear }: StatusFilterProps) {
  const options: { id: StatusId | 'all'; label: string }[] = [
    { id: 'all', label: 'All Deals' },
    ...STATUSES.map((s) => ({ id: s.id, label: s.label })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap overflow-hidden rounded-[4px] border border-[#c9c9c9] bg-white">
        {options.map((option, index) => {
          const active = value === option.id
          const count = option.id === 'all' ? undefined : counts[option.id]
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                index > 0 ? 'border-l border-[#c9c9c9]' : ''
              } ${active ? 'bg-brand-500 text-white' : 'text-brand-700 hover:bg-brand-50'}`}
            >
              {option.label}
              {count !== undefined && count > 0 && (
                <span className={`text-[11px] ${active ? 'text-white/80' : 'text-muted'}`}>
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
          className="flex h-8 items-center gap-1.5 rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[12px] font-semibold text-brand-700 shadow-sm transition-colors hover:bg-canvas"
        >
          <FilterX className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      )}
    </div>
  )
}
