import { AlertTriangle, ChevronRight } from 'lucide-react';
import { formatNextActionDate } from '../../lib/dateUtils';
import { formatUsdCompact } from '../../lib/format';
import { sortByPriority } from '../../lib/sort';
import { getAttentionReasons } from '../../lib/attention';
import StatusBadge from '../common/StatusBadge';
import StageBadge from '../common/StageBadge';
import PriorityBadge from '../common/PriorityBadge';
import type { Opportunity } from '../../types/opportunity';

interface PriorityDealsTableProps {
  opportunities: Opportunity[];
  onSelectOpportunity: (opportunity: Opportunity) => void;
  maxRows?: number;
}

const COLUMN_HEADERS = [
  'Project',
  'Status',
  'Stage',
  'Deal Lead',
  'NWP',
  'Net Revenue',
  'PF EBITDA',
  'Next Action',
];

export default function PriorityDealsTable({ opportunities, onSelectOpportunity, maxRows = 7 }: PriorityDealsTableProps) {
  const sorted = sortByPriority(opportunities);
  const visible = sorted.slice(0, maxRows);
  const hiddenCount = sorted.length - visible.length;

  return (
    <section className="card-shadow flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Priority Deals</h2>
          <p className="mt-0.5 text-sm text-slate-500">Deals warranting attention this week, ranked by priority</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm font-medium text-slate-500">No deals match the current filters</p>
          <p className="text-xs text-slate-400">Try clearing filters or adjusting your search.</p>
        </div>
      ) : (
        <div className="mt-4 -mx-2 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                {COLUMN_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-2 py-2 font-semibold">
                    {header}
                  </th>
                ))}
                <th scope="col" className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((opportunity) => {
                const attention = getAttentionReasons(opportunity);
                return (
                  <tr
                    key={opportunity.id}
                    onClick={() => onSelectOpportunity(opportunity)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${opportunity.projectName}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelectOpportunity(opportunity);
                    }}
                    className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={opportunity.priority} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-navy-900">{opportunity.projectName}</p>
                            {attention.length > 0 && (
                              <AlertTriangle size={13} className="shrink-0 text-amber-500" aria-label="Needs attention" />
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-400">{opportunity.entityName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge status={opportunity.status} />
                    </td>
                    <td className="px-2 py-3">
                      <StageBadge stage={opportunity.stage} />
                    </td>
                    <td className="px-2 py-3 text-sm text-slate-600">
                      {opportunity.dealLead || <span className="text-slate-300">Unassigned</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-sm font-medium tabular-nums text-navy-900">
                      {formatUsdCompact(opportunity.nwp)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-sm tabular-nums text-slate-600">
                      {formatUsdCompact(opportunity.netRevenue)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-sm tabular-nums text-slate-600">
                      {formatUsdCompact(opportunity.pfEbitda)}
                    </td>
                    <td className="px-2 py-3">
                      <p className="max-w-[180px] truncate text-sm text-slate-600">
                        {opportunity.nextAction ?? <span className="text-slate-300">Not scheduled</span>}
                      </p>
                      {opportunity.nextActionDate && (
                        <p className="text-xs text-slate-400">{formatNextActionDate(opportunity.nextActionDate)}</p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="mt-3 text-center text-xs text-slate-400">
          + {hiddenCount} more deal{hiddenCount === 1 ? '' : 's'} match current filters
        </p>
      )}
    </section>
  );
}
