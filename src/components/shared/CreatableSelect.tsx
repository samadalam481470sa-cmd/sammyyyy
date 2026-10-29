import { useEffect, useMemo, useRef, useState } from 'react'

interface CreatableSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  /** Wording for the row that keeps a new typed value. */
  createLabel?: (value: string) => string
  testId?: string
}

/** Same spelling as an existing option, ignoring case and extra spaces. */
export function matchExistingOption(value: string, options: string[]): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return options.find((option) => option.toLowerCase() === clean.toLowerCase()) ?? clean
}

/**
 * Searchable, creatable combobox: click to list known values, type to narrow, or keep a new
 * value exactly as typed (whitespace trimmed, existing spelling reused when it only differs in case).
 */
export function CreatableSelect({ value, options, onChange, placeholder = 'Search or type a new value', id, createLabel, testId }: CreatableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  // Clicking lists every known value; typing narrows the list.
  const [typing, setTyping] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setQuery(value)
  }, [open, value])

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unique = useMemo(() => {
    const seen = new Map<string, string>()
    for (const option of options) {
      const clean = option.replace(/\s+/g, ' ').trim()
      if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [options])

  const typed = query.replace(/\s+/g, ' ').trim()
  const filtered = typed && typing ? unique.filter((option) => option.toLowerCase().includes(typed.toLowerCase())) : unique
  const exists = unique.some((option) => option.toLowerCase() === typed.toLowerCase())

  const commit = (next: string) => {
    const final = matchExistingOption(next, unique)
    onChange(final)
    setQuery(final)
    setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <input
        id={id}
        data-testid={testId}
        className="field-input mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal text-ink normal-case outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true)
          setTyping(false)
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setTyping(true)
          setQuery(event.target.value)
          onChange(event.target.value.replace(/\s+/g, ' ').trim())
          setOpen(true)
        }}
        onBlur={() => {
          if (typed) {
            const final = matchExistingOption(typed, unique)
            if (final !== value) onChange(final)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (typed) commit(typing && filtered.length === 1 && !exists ? filtered[0] : typed)
          }
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-(--shadow-elevated)">
          {typed && typing && !exists && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-semibold text-navy-900 normal-case hover:bg-accent-soft"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(typed)}
              >
                {createLabel ? createLabel(typed) : `Add “${typed}”`}
              </button>
            </li>
          )}
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                className={`w-full px-3 py-2 text-left text-sm font-normal text-ink normal-case hover:bg-accent-soft ${option === value ? 'bg-accent-soft/70' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option)}
              >
                {option}
              </button>
            </li>
          ))}
          {!typed && filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted normal-case">Type to add the first one</li>}
        </ul>
      )}
    </div>
  )
}
