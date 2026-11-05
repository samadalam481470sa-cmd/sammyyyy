import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Filter, Search, X } from 'lucide-react'

/**
 * Shared page chrome: a pale-gray workspace that fills the viewport (no outer page scroll),
 * a compact two-row header, and a white rounded card that holds the table or card grid.
 */
export function PageShell({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-none flex-col overflow-hidden bg-canvas" data-testid={testId}>
      {children}
    </div>
  )
}

/** Row 1: title and subtitle on the left; search and the primary action on the right. */
export function PageTitleBar({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3 lg:px-8">
      <div className="min-w-0">
        <h1 className="font-brand text-2xl leading-tight font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

/** Row 2: segments on the left; count, filter and chips on the right. */
export function PageToolbar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-6 pb-3 lg:px-8">
      <div className="flex flex-wrap items-center gap-1.5">{left}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>
    </div>
  )
}

/** White rounded container that fills the rest of the page. */
export function ContentCard({ children, className = '', plain = false }: { children: ReactNode; className?: string; plain?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-5 lg:px-8">
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${plain ? '' : 'rounded-xl border border-border bg-surface shadow-(--shadow-card)'} ${className}`}>{children}</div>
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, label, testId, width = 'w-60' }: { value: string; onChange: (value: string) => void; placeholder: string; label?: string; testId?: string; width?: string }) {
  return (
    <label className={`relative block ${width} max-w-full`}>
      <span className="sr-only">{label ?? placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        placeholder={placeholder}
        data-testid={testId}
        className="h-10 w-full rounded-lg border border-border bg-surface pr-8 pl-9 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-subtle hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  )
}

export function PrimaryButton({ children, onClick, testId, icon }: { children: ReactNode; onClick: () => void; testId?: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800">
      {icon}
      {children}
    </button>
  )
}

export function SegmentButtons<T extends string>({ options, value, onChange, label }: { options: readonly { id: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.id ? 'border-navy-900 bg-navy-900 text-white' : 'border-border bg-surface text-ink-muted hover:text-ink'
          }`}
        >
          {opt.label}
          {opt.count != null && <span className="ml-1 opacity-70">{opt.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function RecordCount({ count, noun }: { count: number; noun: [string, string] }) {
  return (
    <span className="text-sm font-semibold text-navy-900 tabular-nums" data-testid="record-count">
      {count} {count === 1 ? noun[0] : noun[1]}
    </span>
  )
}

/** Filter button with a popover panel; closes on outside click and Escape. */
export function FilterPopover({ active, children, testId, label = 'Filter', align = 'right' }: { active: boolean; children: ReactNode; testId?: string; label?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={testId}
        className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${active ? 'border-navy-900 bg-navy-900 text-white' : 'border-border bg-surface text-ink hover:bg-canvas'}`}
      >
        <Filter className="h-4 w-4" />
        {label}
      </button>
      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-30 mt-2 w-80 max-w-[90vw] space-y-3 rounded-xl border border-border bg-surface p-4 shadow-(--shadow-elevated)`}>
          {children}
        </div>
      )}
    </div>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{children}</span>
}
