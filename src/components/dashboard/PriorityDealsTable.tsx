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
          ? `Showing top ${MAX_ROWS} of ${sorted.length} matching deals`
          : `${sorted.length} matching deal${sorted.length === 1 ? '' : 's'}`
      }
      flush
    >
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          No deals match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Deal Lead</th>
                <th className="px-3 py-2.5 text-right font-medium">NWP</th>
                <th className="px-3 py-2.5 text-right font-medium">Net Rev</th>
                <th className="px-3 py-2.5 text-right font-medium">PF EBITDA</th>
                <th className="px-5 py-2.5 font-medium">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => onSelect(opp)}
                  className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-navy-50/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-navy-900">{opp.projectName}</span>
                      {opp.needsAttention && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 shrink-0 text-amber-500"
                          aria-label="Needs attention"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{opp.entityName}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={opp.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{stageLabel(opp.stage)}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {opp.dealLead ?? <span className="italic text-slate-400">Unassigned</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-700">
                    {formatMoney(opp.nwp)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {formatMoney(opp.netRevenue)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {formatMoney(opp.pfEbitda)}
                  </td>
                  <td className="px-5 py-3">
                    {opp.nextAction ? (
                      <>
                        <p className="max-w-[220px] truncate text-slate-700">{opp.nextAction}</p>
                        {opp.nextActionDate && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatDate(opp.nextActionDate)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="italic text-slate-400">None assigned</span>
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
