import { useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, History } from 'lucide-react'
import { useDealLeads } from '@/hooks/useDealLeads'
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
  const { leads } = useDealLeads()
  const next = resolveNextAction(opportunity, tasks)
  const overdue = next.taskId && isOverdueDate(next.nextActionDate)
  const days = overdue ? daysOverdue(next.nextActionDate) : 0
  const lead = opportunity.dealLead?.trim()
  const additional = (opportunity.additionalLeadIds ?? []).map((id) => leads.find((row) => row.id === id)?.name).filter(Boolean) as string[]
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={badgeClass(statusBadge(opportunity.status))}>{opportunity.status}</span>
        <span className={badgeClass(stageBadge(opportunity.stage))} title={opportunity.stage}>{opportunity.stage}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/70">
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <InitialsAvatar name={lead} tone="light" />
          <div className="min-w-0">
            <dt className="text-[10px] tracking-[0.08em] uppercase">Deal lead</dt>
            <dd className={`truncate text-sm font-semibold ${lead ? 'text-white' : 'text-[#f6d27a]'}`}>{lead || 'Unassigned'}</dd>
            {additional.length > 0 && <dd className="truncate text-[11px] text-white/70" title={additional.join(', ')} data-testid="header-additional-leads">+ {additional.join(', ')}</dd>}
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

const CHIP_TONE = {
  red: 'bg-[#fde8e6] text-[#b42318]',
  amber: 'bg-[#fdf3d7] text-[#8a5a00]',
  navy: 'bg-accent-soft text-navy-900',
} as const

function chipLabel(reason: string, opportunity: Opportunity, tasks: TaskRecord[]): string {
  if (reason === 'Next action overdue') {
    const days = daysOverdue(resolveNextAction(opportunity, tasks).nextActionDate)
    return days > 0 ? `${days} day${days === 1 ? '' : 's'} overdue` : 'Overdue'
  }
  if (reason === 'No next action assigned') return 'No next action'
  if (reason === 'No deal owner assigned') return 'No deal lead'
  return 'Due within 7 days'
}

/**
 * Needs Attention as one compact chip beside the X, so the header height does not change with the
 * number of warnings. Red for overdue, amber for missing lead or action, blue for due soon.
 * More than one reason, or the detail, opens from the chip.
 */
export function HeaderWarningChip({ opportunity, tasks }: { opportunity: Opportunity; tasks: TaskRecord[] }) {
  const [open, setOpen] = useState(false)
  const warnings = dealWarnings(opportunity, tasks)
  if (!warnings.length) return null
  const first = warnings.find((w) => w.level === 'red') ?? warnings.find((w) => w.level === 'amber') ?? warnings[0]
  return (
    <div className="relative min-w-0" data-testid="drawer-needs-attention">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} title={warnings.map((w) => w.detail).join(' · ')} className={`inline-flex h-7 max-w-[210px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${CHIP_TONE[first.level]}`}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="truncate">{chipLabel(first.reason, opportunity, tasks)}</span>
        {warnings.length > 1 && <span className="shrink-0">+{warnings.length - 1}</span>}
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="absolute top-8 right-0 z-30 w-72 max-w-[80vw] space-y-1.5 rounded-lg border border-border bg-surface p-2.5 text-xs text-ink shadow-(--shadow-elevated)" data-testid="drawer-attention-details">
          {warnings.map((w) => (
            <li key={w.reason}>
              <span className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_TONE[w.level]}`}>{chipLabel(w.reason, opportunity, tasks)}</span>
              {w.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
