import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { useDealLeads } from '@/hooks/useDealLeads'
import { additionalLeadOptions, leadAssignment, primaryLeadOptions, primaryLeadValue, type LeadFields } from '@/lib/dealLeads'

const label = 'text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase'

/**
 * Primary lead plus additional leads, read from the roster. New choices list Active leads only;
 * an inactive lead or an older name already on the deal stays visible until someone changes it.
 */
export function LeadTeamFields({ value, onChange }: { value: LeadFields; onChange: (next: LeadFields) => void }) {
  const { leads } = useDealLeads()
  const additional = value.additionalLeadIds ?? []
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="lead-team-fields">
      <div className="min-w-0">
        <span className={label}>Primary deal lead</span>
        <SearchSelect
          value={primaryLeadValue(value)}
          options={primaryLeadOptions(leads, value)}
          onChange={(id) => onChange(leadAssignment(id, additional, leads))}
          placeholder="Search deal leads"
          emptyText="No matching deal leads"
        />
      </div>
      <div className="min-w-0">
        <span className={label}>Additional deal leads</span>
        <MultiSearchSelect
          testId="additional-leads"
          values={additional}
          options={additionalLeadOptions(leads, value)}
          onChange={(ids) => onChange(leadAssignment(primaryLeadValue(value), ids, leads))}
          placeholder="Add a lead"
          emptyText="No other active deal leads"
        />
      </div>
    </div>
  )
}
