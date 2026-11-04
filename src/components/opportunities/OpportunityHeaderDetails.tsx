import { AlertTriangle, CalendarClock, History } from 'lucide-react'
import type { Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import { InitialsAvatar } from '@/components/shared/Overlay'
import { dealWarnings, daysOverdue } from '@/lib/attention'
import { resolveNextAction } from '@/lib/nextAction'
import { isOverdueDate } from '@/lib/calendarDate'
import { badgeClass, stageBadge, statusBadge } from '@/utils/badges'
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/dashboard'

/**
 * Body of the navy opportunity header shared by the Opportunities edit drawer and the
 * read-only Dashboard drawer: badges, Needs Attention, deal lead, next action and last activity.
 */
export function OpportunityHeaderDetails({ opportunity, tasks, showFinancials = false }: { opportunity: Opportunity; tasks: TaskRecord[]; showFinancials?: boolean }) {
  const warnings = dealWarnings(opportunity, tasks)
  const next = resolveNextAction(opportunity, tasks)
  const overdue = next.taskId && isOverdueDate(next.nextActionDate)
  const days = overdue ? daysOverdue(next.nextActionDate) : 0
  const lead = opportunity.dealLead?.trim()
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={badgeClass(statusBadge(opportunity.status))}>{opportunity.status}</span>
        <span className={badgeClass(stageBadge(opportunity.stage))} title={opportunity.stage}>{opportunity.stage}</span>
      </div>
      {warnings.length > 0 && (
        <div className={`rounded-lg px-3 py-2 text-xs ${warnings.some((w) => w.level === 'red') ? 'bg-[#fde8e6] text-[var(--color-danger)]' : 'bg-accent-soft text-navy-900'}`} data-testid="drawer-needs-attention">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs Attention
          </p>
          <ul className="mt-0.5 space-y-0.5 text-ink">
            {warnings.map((w) => (
              <li key={w.reason}>{w.detail}</li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/70">
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <InitialsAvatar name={lead} tone="light" />
          <div className="min-w-0">
            <dt className="text-[10px] tracking-[0.08em] uppercase">Deal lead</dt>
            <dd className={`truncate text-sm font-semibold ${lead ? 'text-white' : 'text-[#ffb4ab]'}`}>{lead || 'Unassigned'}</dd>
          </div>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="flex items-center gap-1 text-[10px] tracking-[0.08em] uppercase">
            <History className="h-3 w-3" /> Last activity
          </dt>
          <dd className="truncate text-sm text-white">{opportunity.lastActivityDate ? formatRelativeTime(opportunity.lastActivityDate) : '—'}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="flex items-center gap-1 text-[10px] tracking-[0.08em] uppercase">
            <CalendarClock className="h-3 w-3" /> Next action
          </dt>
          <dd className="text-sm text-white">
            {next.nextAction ? (
              <>
                <span className="font-semibold">{next.nextAction}</span>
                <span className={overdue ? ' text-[#ffb4ab]' : ' text-white/75'}>
                  {' '}· due {formatDate(next.nextActionDate)}
                  {overdue && days > 0 ? ` · ${days} day${days === 1 ? '' : 's'} overdue` : ''}
                </span>
              </>
            ) : (
              <span className="text-white/75">—</span>
            )}
          </dd>
        </div>
        {showFinancials && (
          <>
            <div>
              <dt className="text-[10px] tracking-[0.08em] uppercase">NWP</dt>
              <dd className="text-sm font-semibold text-white tabular-nums">{formatCurrency(opportunity.nwp)}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-[0.08em] uppercase">PF EBITDA</dt>
              <dd className="text-sm font-semibold text-white tabular-nums">{formatCurrency(opportunity.pfEbitda)}</dd>
            </div>
          </>
        )}
      </dl>
    </>
  )
}
