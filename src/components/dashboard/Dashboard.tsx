import { useMemo } from "react"
import { useCrm } from "../../context/useCrm.ts"
import { buildDashboardModel } from "../../lib/dashboardModel.ts"
import { formatCompactCurrency } from "../../lib/format.ts"
import { AttentionAlerts } from "./AttentionAlerts.tsx"
import { DashboardCharts } from "./DashboardCharts.tsx"
import { KPICard } from "./KPICard.tsx"
import { NewportAI } from "./NewportAI.tsx"
import { PipelineOverview } from "./PipelineOverview.tsx"
import { PriorityDealsTable } from "./PriorityDealsTable.tsx"
import { PriorityTasks } from "./PriorityTasks.tsx"
import { QuickActions } from "./QuickActions.tsx"
import { RecentActivity } from "./RecentActivity.tsx"
import { StatusFilter } from "./StatusFilter.tsx"

export function Dashboard() {
  const { snapshot, filters, setStatus, toggleAttention } = useCrm()
  const model = useMemo(() => buildDashboardModel(snapshot, filters), [snapshot, filters])

  return (
    <div className="space-y-5">
      <StatusFilter summary={model.filterSummary} />

      <section aria-label="Executive summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard
          label="Active Deals"
          value={String(model.kpis.activeDeals)}
          detail="Being worked through the pipeline"
          onClick={() => setStatus("Active")}
          selected={filters.status === "Active"}
        />
        <KPICard
          label="Pending Deals"
          value={String(model.kpis.pendingDeals)}
          detail="Not yet in active pursuit"
          onClick={() => setStatus("Pending")}
          selected={filters.status === "Pending"}
        />
        <KPICard
          label="Active NWP"
          value={formatCompactCurrency(model.kpis.activeNwp)}
          detail="Net written premium"
        />
        <KPICard
          label="Active PF EBITDA"
          value={formatCompactCurrency(model.kpis.activePfEbitda)}
          detail="Pro forma EBITDA"
        />
        <KPICard
          label="Needs Attention"
          value={String(model.kpis.needsAttention)}
          detail="Overdue, stalled, or unassigned"
          tone="attention"
          onClick={toggleAttention}
          selected={filters.attentionOnly}
        />
      </section>

      <PipelineOverview stages={model.pipeline} subtitle={model.pipelineSubtitle} />

      <PriorityDealsTable
        rows={model.tableRows}
        subtitle={model.tableSubtitle}
        showViewAllActive={model.showViewAllActive}
        activeCount={model.kpis.activeDeals}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <PriorityTasks tasks={model.tasks} />
        <AttentionAlerts alerts={model.alerts} />
      </div>

      <DashboardCharts statusData={model.statusChart} stageData={model.stageChart} stageTitle={model.stageChartTitle} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <RecentActivity items={model.activities} />
        <QuickActions />
      </div>

      <NewportAI />
    </div>
  )
}
