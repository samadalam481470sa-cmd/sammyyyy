import { AlertTriangle } from "lucide-react"
import type { Opportunity } from "../../types/crm.ts"
import { useCrm } from "../../context/useCrm.ts"

export function AttentionAlerts({ alerts }: { alerts: Opportunity[] }) {
  const { openOpportunity } = useCrm()

  return (
    <section className="card card-attention flex h-full flex-col p-5" aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="text-[15px] font-semibold tracking-tight text-ink">
        Needs Attention
      </h2>
      <p className="mt-1 text-sm text-muted">Overdue actions, missing next steps, and stalled activity.</p>
      {alerts.length === 0 ? (
        <p className="py-8 text-sm text-muted">Nothing in this view needs attention.</p>
      ) : (
        <ul className="mt-3">
          {alerts.map((opportunity) => (
            <li key={opportunity.id}>
              <button
                type="button"
                onClick={() => openOpportunity(opportunity.id)}
                className="flex w-full gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/80"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{opportunity.attentionReason}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {opportunity.projectName}
                    <span className="text-muted"> · {opportunity.stage}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
