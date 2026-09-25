import clsx from 'clsx';
import { CircleAlert, SearchX, TriangleAlert } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { formatCurrencyCompact, formatDateShort, formatDueLabel } from '../../lib/format';
import type { OpportunityView } from '../../types';
import { Avatar } from '../ui/Avatar';
import { StageBadge, StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardFooter, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface PriorityDealsTableProps {
  deals: OpportunityView[];
  totalMatching: number;
  maxRows: number;
  isFiltered: boolean;
  onSelect: (opportunity: OpportunityView) => void;
  onClearFilters: () => void;
}

const DUE_TONE_STYLES = {
  overdue: 'text-rose-600',
  today: 'text-amber-700',
  soon: 'text-slate-500',
  scheduled: 'text-slate-400',
  none: 'text-amber-700',
} as const;

export function PriorityDealsTable({
  deals,
  totalMatching,
  maxRows,
  isFiltered,
  onSelect,
  onClearFilters,
}: PriorityDealsTableProps) {
  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, deal: OpportunityView) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(deal);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Priority Deals"
        icon={<CircleAlert className="size-4" />}
        subtitle="Ranked by attention, working priority and process stage"
        actions={
          isFiltered ? (
            <Button size="sm" variant="ghost" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />

      {deals.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="No opportunities match the current filters"
          description="Adjust the status, stage or search terms to see deals here."
          action={
            isFiltered ? (
              <Button size="sm" variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <colgroup>
              <col style={{ width: '13.5%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9.5%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th scope="col" className="px-5 py-2.5">Project</th>
                <th scope="col" className="px-3 py-2.5">Entity</th>
                <th scope="col" className="px-3 py-2.5">Status</th>
                <th scope="col" className="px-3 py-2.5">Stage</th>
                <th scope="col" className="px-3 py-2.5">Deal Lead</th>
                <th scope="col" className="px-3 py-2.5 text-right" title="Net Written Premium">
                  NWP
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">Net Revenue</th>
                <th scope="col" className="px-3 py-2.5 text-right" title="Pro Forma EBITDA">
                  PF EBITDA
                </th>
                <th scope="col" className="px-3 py-2.5">Next Action</th>
                <th scope="col" className="px-5 py-2.5">Next Action Date</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const due = formatDueLabel(deal.nextActionDate);
                return (
                  <tr
                    key={deal.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${deal.projectName}`}
                    onClick={() => onSelect(deal)}
                    onKeyDown={(event) => onRowKeyDown(event, deal)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-navy-50/50 focus-visible:bg-navy-50/50"
                  >
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {deal.needsAttention ? (
                          <TriangleAlert
                            className="size-3.5 shrink-0 text-amber-500"
                            aria-label="Needs attention"
                          />
                        ) : null}
                        <span className="truncate font-semibold tracking-tight text-navy-900">
                          {deal.projectName}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block truncate text-slate-600" title={deal.entityName}>
                        {deal.entityName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={deal.status} />
                    </td>
                    <td className="px-3 py-3">
                      <StageBadge stage={deal.stage} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={deal.dealLead} size="xs" />
                        <span
                          className={clsx(
                            'truncate text-[13px]',
                            deal.dealLead ? 'text-slate-700' : 'font-medium text-amber-700',
                          )}
                        >
                          {deal.dealLead ?? 'Unassigned'}
                        </span>
                      </span>
                    </td>
                    <td className="numeric px-3 py-3 text-right font-medium text-navy-900">
                      {formatCurrencyCompact(deal.nwp)}
                    </td>
                    <td className="numeric px-3 py-3 text-right text-slate-600">
                      {formatCurrencyCompact(deal.netRevenue)}
                    </td>
                    <td className="numeric px-3 py-3 text-right text-slate-600">
                      {formatCurrencyCompact(deal.pfEbitda)}
                    </td>
                    <td className="px-3 py-3">
                      {deal.nextAction ? (
                        <span className="block truncate text-slate-700" title={deal.nextAction}>
                          {deal.nextAction}
                        </span>
                      ) : (
                        <span className="text-[13px] font-medium text-amber-700">
                          No next action
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="numeric block text-[13px] text-slate-700">
                        {formatDateShort(deal.nextActionDate)}
                      </span>
                      <span className={clsx('block text-[11px]', DUE_TONE_STYLES[due.tone])}>
                        {due.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Showing {deals.length} of {totalMatching} matching{' '}
          {totalMatching === 1 ? 'opportunity' : 'opportunities'}
          {totalMatching > maxRows ? ` — top ${maxRows} by priority` : ''}
        </span>
        <span className="text-slate-400">Select a row for the opportunity snapshot.</span>
      </CardFooter>
    </Card>
  );
}
