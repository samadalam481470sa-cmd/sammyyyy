import { useMemo } from 'react'
import { AlertTriangle, Banknote, Briefcase, Clock, TrendingUp } from 'lucide-react'
import type { StageId, StatusId } from '../../config/picklists'
import type { ActivityItem, EnrichedOpportunity, PriorityTask } from '../../types'
import { applyFilters, hasActiveFilters, type DashboardFilters } from '../../lib/filters'
import { formatMoney } from '../../lib/format'
import { StatusFilter } from './StatusFilter'
import { KPICard } from './KPICard'
import { PipelineOverview } from './PipelineOverview'
import { PriorityDealsTable } from './PriorityDealsTable'
import { PriorityTasks } from './PriorityTasks'
import { AttentionAlerts } from './AttentionAlerts'
import { DashboardCharts } from './DashboardCharts'
import { RecentActivity } from './RecentActivity'
import { QuickActions } from './QuickActions'
import { NewportAI } from './NewportAI'

interface DashboardProps {
  opportunities: EnrichedOpportunity[]
  tasks: PriorityTask[]
  activity: ActivityItem[]
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
  onClearFilters: () => void
  onSelectOpportunity: (opportunity: EnrichedOpportunity) => void
  onQuickAction: (label: string) => void
}

export function Dashboard({
  opportunities,
  tasks,
  activity,
  filters,
  onFiltersChange,
  onClearFilters,
  onSelectOpportunity,
  onQuickAction,
}: DashboardProps) {
  // Stage-agnostic set feeds the pipeline (which visualizes every stage);
  // the fully filtered set feeds the table and charts.
  const stageAgnostic = useMemo(
    () => applyFilters(opportunities, filters, { ignoreStage: true }),
    [opportunities, filters],
  )
  const filtered = useMemo(
    () => applyFilters(opportunities, filters),
    [opportunities, filters],
  )

  // Executive KPIs are computed from the full dataset (they summarize the whole
  // pipeline) and double as filter shortcuts.
  const kpis = useMemo(() => {
    const active = opportunities.filter((o) => o.status === 'active')
    const pending = opportunities.filter((o) => o.status === 'pending')
    return {
      activeCount: active.length,
      pendingCount: pending.length,
      activeNwp: active.reduce((sum, o) => sum + o.nwp, 0),
      activePfEbitda: active.reduce((sum, o) => sum + o.pfEbitda, 0),
      attentionCount: opportunities.filter((o) => o.needsAttention).length,
    }
  }, [opportunities])

  const setStatus = (status: StatusId | 'all') => onFiltersChange({ ...filters, status })
  const setStage = (stage: StageId | null) => onFiltersChange({ ...filters, stage })
  const toggleStatus = (status: StatusId) =>
    setStatus(filters.status === status ? 'all' : status)
  const toggleAttention = () =>
    onFiltersChange({ ...filters, attentionOnly: !filters.attentionOnly })

  return (
    <div className="space-y-4 px-5 py-4">
      <StatusFilter
        value={filters.status}
        counts={Object.fromEntries(
          opportunities.reduce(
            (map, o) => map.set(o.status, (map.get(o.status) ?? 0) + 1),
            new Map<string, number>(),
          ),
        )}
        showClear={hasActiveFilters(filters)}
        onChange={setStatus}
        onClear={onClearFilters}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPICard
          label="Active Deals"
          value={String(kpis.activeCount)}
          caption="Currently in process"
          icon={Briefcase}
          selected={filters.status === 'active'}
          onClick={() => toggleStatus('active')}
        />
        <KPICard
          label="Pending Deals"
          value={String(kpis.pendingCount)}
          caption="Awaiting next step"
          icon={Clock}
          selected={filters.status === 'pending'}
          onClick={() => toggleStatus('pending')}
        />
        <KPICard
          label="Active NWP"
          value={formatMoney(kpis.activeNwp)}
          caption="Net written premium, active deals"
          icon={Banknote}
        />
        <KPICard
          label="Active PF EBITDA"
          value={formatMoney(kpis.activePfEbitda)}
          caption="Pro forma EBITDA, active deals"
          icon={TrendingUp}
        />
        <KPICard
          label="Needs Attention"
          value={String(kpis.attentionCount)}
          caption="Overdue, stalled, or missing actions"
          icon={AlertTriangle}
          emphasis="attention"
          selected={filters.attentionOnly}
          onClick={toggleAttention}
        />
      </div>

      <PipelineOverview
        opportunities={stageAgnostic}
        selectedStage={filters.stage}
        onSelectStage={setStage}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <PriorityDealsTable opportunities={filtered} onSelect={onSelectOpportunity} />
          <DashboardCharts opportunities={filtered} />
          <RecentActivity activity={activity} />
        </div>
        <div className="min-w-0 space-y-4">
          <PriorityTasks tasks={tasks} />
          <AttentionAlerts opportunities={stageAgnostic} onSelect={onSelectOpportunity} />
          <NewportAI />
          <QuickActions onAction={onQuickAction} />
        </div>
      </div>
    </div>
  )
}
