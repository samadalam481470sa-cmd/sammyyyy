import { X } from 'lucide-react'
import { opportunityTypeLabel, sourceTypeLabel, stageLabel } from '../../config/picklists'
import type { EnrichedOpportunity } from '../../types'
import { formatDate, formatMoney } from '../../lib/format'
import { StatusBadge, StageBadge } from '../common/Badges'

interface OpportunityDrawerProps {
  opportunity: EnrichedOpportunity
  onClose: () => void
}

/** Salesforce-style record panel. The full Opportunity Profile arrives in a later sprint. */
export function OpportunityDrawer({ opportunity, onClose }: OpportunityDrawerProps) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={opportunity.projectName}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Opportunity</p>
              <h2 className="mt-0.5 text-lg font-bold text-ink">{opportunity.projectName}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{opportunity.entityName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {opportunity.needsAttention && (
            <div className="mb-4 rounded-[4px] border border-[#f9e3b6] bg-[#fff8ec] px-4 py-3">
              <p className="text-[11px] font-bold tracking-wide text-[#8c4b02] uppercase">
                Needs attention
              </p>
              <ul className="mt-1.5 space-y-1">
                {opportunity.attentionReasons.map((reason) => (
                  <li key={reason.kind} className="text-[13px] text-[#5c3404]">
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

          <div className="mt-5 rounded-[4px] border border-line">
            <p className="border-b border-line bg-[#fafaf9] px-4 py-2 text-[11px] font-bold tracking-wide text-muted uppercase">
              Financials
            </p>
            <dl className="grid grid-cols-3 divide-x divide-line">
              <FinancialField label="NWP" value={formatMoney(opportunity.nwp)} />
              <FinancialField label="Net Revenue" value={formatMoney(opportunity.netRevenue)} />
              <FinancialField label="PF EBITDA" value={formatMoney(opportunity.pfEbitda)} />
            </dl>
          </div>

          <div className="mt-5 rounded-[4px] border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">Next Action</p>
            {opportunity.nextAction ? (
              <>
                <p className="mt-1 text-sm font-semibold text-ink">{opportunity.nextAction}</p>
                {opportunity.nextActionDate && (
                  <p className="mt-0.5 text-[12px] text-muted">
                    Due {formatDate(opportunity.nextActionDate)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-muted italic">No next action assigned</p>
            )}
          </div>
        </div>

        <footer className="border-t border-line bg-[#fafaf9] px-5 py-3">
          <p className="text-center text-[12px] font-semibold text-muted">
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
      <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-ink">{value}</dd>
    </div>
  )
}

function FinancialField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <dt className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
