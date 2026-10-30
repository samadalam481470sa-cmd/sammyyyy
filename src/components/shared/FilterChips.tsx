import { X } from 'lucide-react'

export interface ActiveFilterChip {
  key: string
  label: string
  onRemove: () => void
  tone?: 'navy' | 'attention'
}

/** Removable chips for every active filter, plus Clear All when more than one is active. */
export function FilterChips({ chips, onClearAll }: { chips: ActiveFilterChip[]; onClearAll: () => void }) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-xs font-semibold ${
            chip.tone === 'attention'
              ? 'border-attention bg-attention-bg text-attention'
              : 'border-navy-900 bg-accent-soft text-navy-900'
          }`}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}`}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/70"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Clear All
        </button>
      )}
    </div>
  )
}
