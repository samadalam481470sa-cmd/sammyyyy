import { ProfileLinkButton } from '@/components/profile/ProfileLinkButton'
import { DrawerHeader, SideDrawer } from '@/components/shared/Overlay'
import { HeaderWarningChip, OpportunityHeaderDetails } from '@/components/opportunities/OpportunityHeaderDetails'
import { useData } from '@/data/DataContext'
import { dealIdFromOpportunity } from '@/lib/dealId'
import type { Opportunity } from '@/types'
import { formatCurrency, formatDate } from '@/utils/dashboard'

interface OpportunityDrawerProps {
  opportunity: Opportunity | null
  onClose: () => void
}

/**
 * The one READ-ONLY opportunity drawer used by Deals Requiring Action, This Week's Priorities
 * and Needs Attention. Same navy header as the edit drawer, no editing controls.
 */
export function OpportunityDrawer({ opportunity, onClose }: OpportunityDrawerProps) {
  const { tasks, opportunities } = useData()
  // Always show the live record so the drawer matches the rest of the CRM.
  const live = opportunity ? (opportunities.find((o) => o.id === opportunity.id) ?? opportunity) : null
  return (
    <SideDrawer open={Boolean(live)} onRequestClose={onClose} label="Opportunity details" testId="dashboard-opportunity-drawer">
      {live && (
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader eyebrow={dealIdFromOpportunity(live)} title={live.projectName} subtitle={live.entityName} onClose={onClose} closeLabel="Close opportunity details" actions={<HeaderWarningChip opportunity={live} tasks={tasks} />}>
            <OpportunityHeaderDetails opportunity={live} tasks={tasks} showFinancials />
          </DrawerHeader>
          <div className="custom-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm" data-testid="dashboard-drawer-fields">
              {[
                ['Acquisition type', live.type],
                ['Specialty', live.specialty || '—'],
                ['Geography', live.geography || '—'],
                ['Source', [live.sourceType, live.sourceName].filter(Boolean).join(' · ') || '—'],
                ['Net Revenue', formatCurrency(live.netRevenue)],
                ['Created', live.createdAt ? formatDate(live.createdAt) : 'Not recorded'],
                ['Last updated', formatDate(live.updatedAt ?? live.lastActivityDate ?? null)],
                ['Legally closed', live.status === 'Completed' && live.closedAt ? formatDate(live.closedAt) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 border-b border-border/70 pb-2">
                  <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">{label}</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
            {live.diligenceNotes && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Diligence notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{live.diligenceNotes}</p>
              </div>
            )}
            <p className="mt-4 text-[11px] text-ink-subtle">Read-only summary. Open the full profile to edit.</p>
          </div>
          <div className="shrink-0 border-t border-border bg-surface px-5 py-3">
            <ProfileLinkButton opportunityId={live.id} />
          </div>
        </div>
      )}
    </SideDrawer>
  )
}
