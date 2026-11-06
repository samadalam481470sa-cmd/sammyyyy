import type { Opportunity } from '@/types'
import { formatCurrency, formatDate } from '@/utils/dashboard'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'

interface PriorityDealsTableProps {
  opportunities: Opportunity[]
  onSelect: (opportunity: Opportunity) => void
}

export function PriorityDealsTable({ opportunities, onSelect }: PriorityDealsTableProps) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-(--shadow-card)">
      <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-brand text-lg font-bold text-navy-900">Deals Requiring Action</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Confidential project code names with key financials and next actions
          </p>
        </div>
      </div>

      {/* Fits the card at desktop widths (about 1000px of table and up). Narrower windows keep a
          horizontal scroll as the fallback instead of squeezing columns unreadably. Net Revenue is
          left out of this summary only; it stays on records, profiles, Reports and exports. */}
      <div className="custom-scroll overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm" data-testid="priority-deals-table">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[98px]" />
            <col className="w-[148px]" />
            <col className="w-[12%]" />
            <col className="w-[78px]" />
            <col className="w-[86px]" />
            <col />
            <col className="w-[116px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-canvas/80 text-[11px] tracking-[0.06em] text-ink-subtle uppercase">
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-3 py-3 font-semibold">Company</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Stage</th>
              <th className="px-3 py-3 font-semibold">Deal Lead</th>
              <th className="px-3 py-3 text-right font-semibold">NWP</th>
              <th className="px-3 py-3 text-right font-semibold">PF EBITDA</th>
              <th className="px-3 py-3 font-semibold">Next Action</th>
              <th className="px-4 py-3 font-semibold">Next Action Date</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-ink-muted">
                  No opportunities match the current filters.
                </td>
              </tr>
            ) : (
              opportunities.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => onSelect(opp)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(opp)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-accent-soft/40 focus-visible:bg-accent-soft/50 focus-visible:outline-none"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {opp.needsAttention && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                          title="Needs attention"
                        />
                      )}
                      <span className="truncate font-semibold text-navy-900" title={opp.projectName}>{opp.projectName}</span>
                    </div>
                  </td>
                  <td className="truncate px-3 py-3.5 text-ink-muted" title={opp.entityName}>{opp.entityName}</td>
                  <td className="px-3 py-3.5">
                    <span
                      className={badgeClass(statusBadge(opp.status))}
                    >
                      {opp.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    {/* The full stage name always shows: long names wrap to a second line instead of being cut. */}
                    <span className={`${badgeClass(stageBadge(opp.stage))} overflow-visible! whitespace-normal!`} title={opp.stage} data-testid="deal-stage-badge">{opp.stage}</span>
                  </td>
                  <td className="truncate px-3 py-3.5 text-ink-muted" title={opp.dealLead || undefined}>{opp.dealLead || '—'}</td>
                  <td className="px-3 py-3.5 text-right font-medium tabular-nums text-ink">
                    {formatCurrency(opp.nwp)}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-ink-muted">
                    {formatCurrency(opp.pfEbitda)}
                  </td>
                  <td className="truncate px-3 py-3.5 text-ink" title={opp.nextAction ?? undefined}>
                    {opp.nextAction ?? (
                      <span className="text-warning italic">No next action</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-ink-muted">
                    {formatDate(opp.nextActionDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
