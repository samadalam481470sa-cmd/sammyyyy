import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { SearchSelectOption } from '@/components/shared/SearchSelect'

interface MultiSearchSelectProps {
  values: string[]
  options: SearchSelectOption[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyText?: string
  testId?: string
}

/** Compact searchable multi-select: chips for chosen items, click to browse, type to filter. */
export function MultiSearchSelect({ values, options, onChange, placeholder = 'Search…', emptyText = 'No matches', testId }: MultiSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const chosen = values.map((id) => options.find((row) => row.id === id) ?? { id, label: 'Unavailable project' })
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((row) => `${row.label} ${row.detail ?? ''}`.toLowerCase().includes(q)) : options
  }, [options, query])

  const toggle = (id: string) => onChange(values.includes(id) ? values.filter((row) => row !== id) : [...values, id])

  return (
    <div ref={root} className="relative mt-1.5" data-testid={testId}>
      <div
        className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
        onClick={() => setOpen(true)}
      >
        {chosen.map((row) => (
          <span key={row.id} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-navy-900 normal-case">
            {row.label}
            <button
              type="button"
              aria-label={`Remove ${row.label}`}
              className="rounded p-0.5 hover:bg-white/60"
              onClick={(event) => {
                event.stopPropagation()
                toggle(row.id)
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 text-sm font-normal text-ink normal-case outline-none"
          value={query}
          placeholder={values.length ? 'Add another…' : placeholder}
          role="combobox"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !query && values.length) onChange(values.slice(0, -1))
            if (event.key === 'Escape' && open) {
              event.stopPropagation()
              setOpen(false)
            }
          }}
        />
      </div>
      {open && (
        <ul role="listbox" aria-multiselectable="true" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-(--shadow-elevated)">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted normal-case">{emptyText}</li>}
          {filtered.map((row) => {
            const on = values.includes(row.id)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm normal-case hover:bg-accent-soft ${on ? 'bg-accent-soft/60' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggle(row.id)}
                >
                  <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-navy-900 bg-navy-900 text-white' : 'border-border'}`}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{row.label}</span>
                    {row.detail && <span className="block text-xs font-normal text-ink-muted">{row.detail}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
