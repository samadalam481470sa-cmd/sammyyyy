import { AlertTriangle } from 'lucide-react'
import { stageLabel } from '../../config/picklists'
import type { EnrichedOpportunity } from '../../types'
import { formatDate, formatMoney } from '../../lib/format'
import { Card } from '../common/Card'
import { StatusBadge } from '../common/Badges'

const MAX_ROWS = 7

interface PriorityDealsTableProps {
  opportunities: EnrichedOpportunity[]
  onSelect: (opportunity: EnrichedOpportunity) => void
}

/** Salesforce list view: bold column headers, blue record links, compact rows. */
export function PriorityDealsTable({ opportunities, onSelect }: PriorityDealsTableProps) {
  const sorted = [...opportunities].sort(
    (a, b) =>
      a.priority.localeCompare(b.priority) ||
      Number(b.needsAttention) - Number(a.needsAttention) ||
      b.nwp - a.nwp,
  )
  const rows = sorted.slice(0, MAX_ROWS)

  return (
    <Card
      title="Priority Deals"
      subtitle={
        sorted.length > MAX_ROWS
          ? `${sorted.length} items · showing ${MAX_ROWS}`
          : `${sorted.length} item${sorted.length === 1 ? '' : 's'}`
      }
      flush
    >
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted">
          No deals match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-[#fafaf9] text-[11px] font-bold text-[#444]">
                <th className="px-4 py-2 font-bold">Project</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold">Stage</th>
                <th className="px-3 py-2 font-bold">Deal Lead</th>
                <th className="px-3 py-2 text-right font-bold">NWP</th>
                <th className="px-3 py-2 text-right font-bold">Net Revenue</th>
                <th className="px-3 py-2 text-right font-bold">PF EBITDA</th>
                <th className="px-4 py-2 font-bold">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => onSelect(opp)}
                  className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[#f3f3f3]"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-brand-500 hover:underline">
                        {opp.projectName}
                      </span>
                      {opp.needsAttention && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 shrink-0 text-hub-500"
                          aria-label="Needs attention"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{opp.entityName}</p>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={opp.status} />
                  </td>
                  <td className="px-3 py-2 text-[#444]">{stageLabel(opp.stage)}</td>
                  <td className="px-3 py-2 text-[#444]">
                    {opp.dealLead ?? <span className="text-muted italic">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">
                    {formatMoney(opp.nwp)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#444]">
                    {formatMoney(opp.netRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#444]">
                    {formatMoney(opp.pfEbitda)}
                  </td>
                  <td className="px-4 py-2">
                    {opp.nextAction ? (
                      <>
                        <p className="max-w-[220px] truncate text-[#444]">{opp.nextAction}</p>
                        {opp.nextActionDate && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            {formatDate(opp.nextActionDate)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted italic">None assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
