import { AlertCircle, CalendarClock, Clock, UserX } from 'lucide-react'
import type { AttentionRow } from '@/lib/attention'
import { dealIdFromOpportunity } from '@/lib/dealId'

interface AttentionAlertsProps {
  rows: AttentionRow[]
  limit?: number
  onProjectClick?: (projectId: string) => void
  onViewAll?: () => void
}

/** Needs Attention: one row per Active/Pending deal, most urgent first (see attentionRows). */
export function AttentionAlerts({ rows, limit = 6, onProjectClick, onViewAll }: AttentionAlertsProps) {
  const shown = rows.slice(0, limit)
  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card)" data-testid="needs-attention">
      <div className="flex items-start justify-between gap-2 rounded-t-xl border-b border-[#f0e2bd] bg-[#fdf7e7] px-5 py-3.5" data-testid="needs-attention-heading">
        <div>
          <h2 className="font-brand text-lg font-bold text-navy-900">Needs Attention</h2>
          <p className="mt-0.5 text-sm text-[#7a5c1e]">
            {rows.length} Active/Pending deal{rows.length === 1 ? '' : 's'} · most overdue first
          </p>
        </div>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="text-xs font-semibold text-accent hover:underline">
            View all
          </button>
        )}
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-border/70">
        {shown.length === 0 && <li className="px-5 py-8 text-sm text-ink-muted">No Active or Pending deal needs attention.</li>}
        {shown.map((row) => {
          // Only a genuinely overdue deadline is red. Every icon and every other label stays amber.
          const overdue = row.group === 0
          const Icon = row.group === 0 ? Clock : row.group === 1 ? AlertCircle : row.group === 2 ? UserX : CalendarClock
          return (
            <li key={row.opportunity.id} className="flex-1">
              <button type="button" onClick={() => onProjectClick?.(row.opportunity.id)} className="flex h-full w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent-soft/30" data-testid={`attention-row-${row.opportunity.id}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fdf3d7] text-[#b7791f]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy-900">{row.opportunity.projectName}</span>
                    <span className="shrink-0 text-[11px] text-ink-subtle">{dealIdFromOpportunity(row.opportunity)}</span>
                  </span>
                  <span className={`block text-xs font-semibold ${overdue ? 'text-[var(--color-danger)]' : 'text-[#946200]'}`} data-testid="attention-label">
                    {overdue ? `${row.overdueDays} day${row.overdueDays === 1 ? '' : 's'} overdue` : row.primary.reason}
                    {row.warnings.length > 1 && <span className="font-normal text-ink-muted"> · +{row.warnings.length - 1} more</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{row.primary.detail}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
