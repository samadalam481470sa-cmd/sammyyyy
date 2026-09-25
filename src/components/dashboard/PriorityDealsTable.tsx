import type { Opportunity } from "../../types/crm.ts"
import { useCrm } from "../../context/useCrm.ts"
import { formatCompactCurrency, formatDate } from "../../lib/format.ts"
import { isOverdue } from "../../lib/dates.ts"
import { cn } from "../../lib/cn.ts"
import { StatusPill } from "../ui/Marks.tsx"

const COLUMNS = [
  "Project",
  "Entity",
  "Status",
  "Stage",
  "Deal Lead",
  "NWP",
  "Net Revenue",
  "PF EBITDA",
  "Next Action",
  "Next Action Date",
] as const

export function PriorityDealsTable({
  rows,
  subtitle,
  showViewAllActive,
  activeCount,
}: {
  rows: Opportunity[]
  subtitle: string
  showViewAllActive: boolean
  activeCount: number
}) {
  const { snapshot, openOpportunity, setStatus, clearFilters } = useCrm()

  return (
    <section className="card" aria-labelledby="priority-deals-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 id="priority-deals-heading" className="text-[15px] font-semibold tracking-tight text-ink">
            Priority Deals
          </h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {showViewAllActive ? (
          <button type="button" onClick={() => setStatus("Active")} className="text-sm font-semibold text-navy-700">
            View all {activeCount} active
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted">No opportunities match these filters.</p>
          <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-navy-700">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <caption className="sr-only">Priority acquisition opportunities</caption>
            <thead>
              <tr className="border-y border-line bg-[#f7f8fa] text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn(
                      "px-3 py-2.5 font-semibold whitespace-nowrap",
                      column === "Project" && "pl-5",
                      column === "Next Action Date" && "pr-5",
                      (column === "NWP" || column === "Net Revenue" || column === "PF EBITDA") && "text-right",
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((opportunity) => {
                const overdue = isOverdue(opportunity.nextActionDate, snapshot.asOf)
                return (
                  <tr
                    key={opportunity.id}
                    className="cursor-pointer border-b border-line last:border-b-0 hover:bg-accent-100/50"
                    onClick={() => openOpportunity(opportunity.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openOpportunity(opportunity.id)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${opportunity.projectName}`}
                  >
                    <td className="py-3 pr-3 pl-5 font-semibold text-ink">
                      <span className="inline-flex items-center gap-2">
                        {opportunity.projectName}
                        {opportunity.needsAttention ? (
                          <span className="size-1.5 rounded-full bg-amber" title={opportunity.attentionReason ?? "Needs attention"} />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted">{opportunity.entityName}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusPill status={opportunity.status} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink">{opportunity.stage}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink">{opportunity.dealLead ?? "Unassigned"}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">{formatCompactCurrency(opportunity.nwp)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{formatCompactCurrency(opportunity.netRevenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{formatCompactCurrency(opportunity.pfEbitda)}</td>
                    <td className="max-w-[220px] px-3 py-3 text-ink">{opportunity.nextAction ?? "Not assigned"}</td>
                    <td className={cn("py-3 pr-5 pl-3 whitespace-nowrap tabular-nums", overdue ? "font-semibold text-amber" : "text-ink")}>
                      {formatDate(opportunity.nextActionDate)}
                      {overdue ? <span className="mt-0.5 block text-[11px] font-semibold">Overdue</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
