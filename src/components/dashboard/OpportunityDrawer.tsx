import { X } from 'lucide-react'
import {
  opportunityTypeLabel,
  sourceTypeLabel,
  stageLabel,
} from '../../config/picklists'
import type { EnrichedOpportunity } from '../../types'
import { formatDate, formatMoney } from '../../lib/format'
import { StatusBadge, StageBadge } from '../common/Badges'

interface OpportunityDrawerProps {
  opportunity: EnrichedOpportunity
  onClose: () => void
}

/** Slide-in summary drawer. The full Opportunity Profile arrives in a later sprint. */
export function OpportunityDrawer({ opportunity, onClose }: OpportunityDrawerProps) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={opportunity.projectName}>
      <div className="absolute inset-0 bg-navy-950/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-navy-900">{opportunity.projectName}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{opportunity.entityName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={opportunity.status} />
            <StageBadge stage={opportunity.stage} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {opportunity.needsAttention && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Needs attention
              </p>
              <ul className="mt-1.5 space-y-1">
                {opportunity.attentionReasons.map((reason) => (
                  <li key={reason.kind} className="text-[13px] text-amber-800">
                    {reason.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField label="Deal Lead" value={opportunity.dealLead ?? 'Unassigned'} />
            <DetailField label="Type" value={opportunityTypeLabel(opportunity.type)} />
            <DetailField
              label="Source"
              value={`${opportunity.sourceName} (${sourceTypeLabel(opportunity.sourceType)})`}
            />
            <DetailField label="Specialty" value={opportunity.specialty} />
            <DetailField label="Geography" value={opportunity.geography} />
            <DetailField label="Stage" value={stageLabel(opportunity.stage)} />
          </dl>

          <div className="mt-6 rounded-lg border border-slate-200">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Financials
            </p>
            <dl className="grid grid-cols-3 divide-x divide-slate-100">
              <FinancialField label="NWP" value={formatMoney(opportunity.nwp)} />
              <FinancialField label="Net Revenue" value={formatMoney(opportunity.netRevenue)} />
              <FinancialField label="PF EBITDA" value={formatMoney(opportunity.pfEbitda)} />
            </dl>
          </div>

          <div className="mt-6 rounded-lg bg-navy-50/70 px-4 py-3.5 ring-1 ring-navy-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              Next Action
            </p>
            {opportunity.nextAction ? (
              <>
                <p className="mt-1 text-sm font-medium text-navy-900">{opportunity.nextAction}</p>
                {opportunity.nextActionDate && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Due {formatDate(opportunity.nextActionDate)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm italic text-slate-500">No next action assigned</p>
            )}
          </div>
        </div>

        <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="text-center text-xs font-medium text-slate-500">
            Full Opportunity Profile — Coming in next sprint
          </p>
        </footer>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-slate-700">{value}</dd>
    </div>
  )
}

function FinancialField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-navy-900">{value}</dd>
    </div>
  )
}
