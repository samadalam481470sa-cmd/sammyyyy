import { useEffect, useMemo, useRef, useState } from 'react'

export interface SearchSelectOption {
  id: string
  label: string
  detail?: string
}

interface SearchSelectProps {
  value: string | null
  options: SearchSelectOption[]
  onChange: (id: string | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  id?: string
}

export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  disabled,
  id,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((row) => row.id === value) ?? null

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '')
  }, [open, selected?.label, value])

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((row) =>
      `${row.label} ${row.detail ?? ''}`.toLowerCase().includes(q),
    )
  }, [options, query])

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        disabled={disabled}
        className="field-input mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={open}
        aria-haspopup="listbox"
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-(--shadow-elevated)"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">{emptyText}</li>
          )}
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={row.id === value}
                className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent-soft ${
                  row.id === value ? 'bg-accent-soft/70' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(row.id)
                  setOpen(false)
                }}
              >
                <span className="font-medium text-ink">{row.label}</span>
                {row.detail && <span className="text-xs text-ink-muted">{row.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
