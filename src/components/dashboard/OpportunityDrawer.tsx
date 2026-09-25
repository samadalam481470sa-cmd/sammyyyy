import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import { useCrm } from "../../context/useCrm.ts"
import { formatDate, formatFullCurrency } from "../../lib/format.ts"
import { StatusPill } from "../ui/Marks.tsx"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  )
}

export function OpportunityDrawer() {
  const { selectedOpportunity, closeOpportunity } = useCrm()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selectedOpportunity) closeRef.current?.focus()
  }, [selectedOpportunity])

  if (!selectedOpportunity) return null

  const opportunity = selectedOpportunity

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-navy-950/40" aria-label="Close opportunity" onClick={closeOpportunity} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-16px_0_48px_rgb(7_20_34_/_0.18)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Project</p>
            <h2 id="opportunity-title" className="mt-1 text-xl font-semibold tracking-tight text-ink">
              {opportunity.projectName}
            </h2>
            <p className="mt-1 text-sm text-muted">{opportunity.entityName}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeOpportunity}
            className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {opportunity.attentionReason ? (
            <p className="mb-5 rounded-xl bg-amber-soft px-3 py-2 text-sm text-amber">{opportunity.attentionReason}</p>
          ) : null}
          <dl className="grid grid-cols-2 gap-5">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Status</dt>
              <dd className="mt-1.5">
                <StatusPill status={opportunity.status} />
              </dd>
            </div>
            <Field label="Stage" value={opportunity.stage} />
            <div className="col-span-2">
              <Field label="Deal lead" value={opportunity.dealLead ?? "Unassigned"} />
            </div>
            <Field label="NWP" value={formatFullCurrency(opportunity.nwp)} />
            <Field label="Net Revenue" value={formatFullCurrency(opportunity.netRevenue)} />
            <Field label="PF EBITDA" value={formatFullCurrency(opportunity.pfEbitda)} />
            <div className="col-span-2">
              <Field label="Next action" value={opportunity.nextAction ?? "Not assigned"} />
            </div>
            <Field label="Next action date" value={formatDate(opportunity.nextActionDate, true)} />
          </dl>
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="text-sm font-medium text-navy-800">Full Opportunity Profile — Coming in next sprint</p>
        </div>
      </aside>
    </div>
  )
}
