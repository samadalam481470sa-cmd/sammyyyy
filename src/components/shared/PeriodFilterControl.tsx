import type { PeriodFilter } from '@/lib/reports'

interface Props {
  value: PeriodFilter
  onChange: (next: PeriodFilter) => void
  /** Offer "Last 30 days" (rolling). */
  allowLast30?: boolean
  /** Label for the unbounded option. */
  allLabel?: string
  testId?: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Period picker shared by Reports, Meeting History, Task History and Recent Activity. */
export function PeriodFilterControl({ value, onChange, allowLast30 = false, allLabel = 'All Time', testId }: Props) {
  const now = new Date()
  const input = 'h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <label className="sr-only" htmlFor={`${testId ?? 'period'}-kind`}>
        Period
      </label>
      <select
        id={`${testId ?? 'period'}-kind`}
        className={input}
        value={value.kind}
        aria-label="Period"
        onChange={(e) => {
          const kind = e.target.value as PeriodFilter['kind']
          if (kind === 'month') onChange({ kind, month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` })
          else if (kind === 'year') onChange({ kind, year: String(now.getFullYear()) })
          else if (kind === 'range') onChange({ kind, from: '', to: '' })
          else onChange({ kind })
        }}
      >
        {allowLast30 && <option value="last30">Last 30 days</option>}
        <option value="all">{allLabel}</option>
        <option value="month">Month</option>
        <option value="year">Year</option>
        <option value="range">Custom Date Range</option>
      </select>
      {value.kind === 'month' && <input type="month" aria-label="Month" className={input} value={value.month ?? ''} onChange={(e) => onChange({ ...value, month: e.target.value })} />}
      {value.kind === 'year' && (
        <input type="number" aria-label="Year" min={2000} max={2100} className={`${input} w-24`} value={value.year ?? ''} onChange={(e) => onChange({ ...value, year: e.target.value })} />
      )}
      {value.kind === 'range' && (
        <>
          <input type="date" aria-label="From date" className={input} value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-xs text-ink-muted">to</span>
          <input type="date" aria-label="To date" className={input} value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  )
}
