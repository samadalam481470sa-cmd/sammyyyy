import {
  Briefcase,
  Clock,
  Scale,
  TrendingUp,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { statusLabel, type OpportunityStatusId } from '../../config/picklists';
import { useDashboard } from '../../hooks/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { sortByAttentionSeverity } from '../../lib/attention';
import {
  ALL_STATUSES,
  describeFilters,
  filterOpportunities,
  resolveScopeStatus,
  sortPriorityDeals,
  type FilterDimension,
} from '../../lib/filtering';
import { formatCurrencyCompact } from '../../lib/format';
import { buildStageSummary, buildStatusSummary, summarizeOpportunities } from '../../lib/metrics';
import type { OpportunityView } from '../../types';
import { Button } from '../ui/Button';
import { AttentionAlerts } from './AttentionAlerts';
import { DashboardCharts } from './DashboardCharts';
import { KPICard } from './KPICard';
import { NewportAI } from './NewportAI';
import { OpportunityDrawer } from './OpportunityDrawer';
import { PipelineOverview } from './PipelineOverview';
import { PriorityDealsTable } from './PriorityDealsTable';
import { PriorityTasks } from './PriorityTasks';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';
import { StatusFilter } from './StatusFilter';

/** The Priority Deals table stays short by design — it is a working list. */
const MAX_PRIORITY_ROWS = 7;

export function Dashboard() {
  const { opportunities, opportunitiesById, snapshot, isLoading, error } = useDashboard();
  const {
    filters,
    setStatus,
    toggleStage,
    clearFilter,
    clearFilters,
    toggleAttentionOnly,
    isFiltered,
  } = useDashboardFilters();

  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityView | null>(null);

  /** Search and the attention toggle scope the whole dashboard. */
  const scoped = useMemo(
    () => filterOpportunities(opportunities, filters, ['status', 'stage']),
    [opportunities, filters],
  );

  const metrics = useMemo(() => summarizeOpportunities(scoped), [scoped]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const summary of buildStatusSummary(scoped)) counts[summary.id] = summary.count;
    return counts;
  }, [scoped]);

  /** Table rows honour every filter. */
  const matchingDeals = useMemo(
    () => filterOpportunities(opportunities, filters),
    [opportunities, filters],
  );
  const priorityDeals = useMemo(
    () => sortPriorityDeals(matchingDeals).slice(0, MAX_PRIORITY_ROWS),
    [matchingDeals],
  );

  /** Pipeline and the stage chart describe deals in flight for one status. */
  const scopeStatus = resolveScopeStatus(filters);
  const scopeStatusName = statusLabel(scopeStatus);
  const stageScoped = useMemo(
    () => scoped.filter((opportunity) => opportunity.status === scopeStatus),
    [scoped, scopeStatus],
  );
  const stageSummary = useMemo(() => buildStageSummary(stageScoped), [stageScoped]);
  const stageTotals = useMemo(
    () => ({
      count: stageScoped.length,
      nwp: stageScoped.reduce((total, opportunity) => total + opportunity.nwp, 0),
    }),
    [stageScoped],
  );

  /** The status chart keeps every status visible and highlights the selection. */
  const statusChartData = useMemo(
    () => buildStatusSummary(filterOpportunities(opportunities, filters, ['status'])),
    [opportunities, filters],
  );

  const attentionList = useMemo(
    () =>
      sortByAttentionSeverity(
        filterOpportunities(opportunities, filters, ['attention']).filter(
          (opportunity) => opportunity.needsAttention,
        ),
      ),
    [opportunities, filters],
  );

  const visibleTasks = useMemo(() => snapshot?.tasks ?? [], [snapshot]);
  const visibleActivity = useMemo(() => snapshot?.activity ?? [], [snapshot]);

  function toggleStatus(status: OpportunityStatusId) {
    setStatus(filters.status === status ? ALL_STATUSES : status);
  }

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm font-medium text-navy-900">Unable to load the acquisition pipeline</p>
        <p className="mt-1 text-xs text-slate-500">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-5 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <StatusFilter
          value={filters.status}
          counts={statusCounts}
          totalCount={scoped.length}
          onChange={setStatus}
        />
        <QuickActions />
      </div>

      {isFiltered ? <ActiveFilters onClear={clearFilter} onClearAll={clearFilters} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard
          label="Active Deals"
          value={String(metrics.activeCount)}
          hint="Opportunities being actively worked"
          icon={<Briefcase className="size-4" />}
          active={filters.status === 'active'}
          onClick={() => toggleStatus('active')}
        />
        <KPICard
          label="Pending Deals"
          value={String(metrics.pendingCount)}
          hint="Awaiting information or a decision"
          icon={<Clock className="size-4" />}
          active={filters.status === 'pending'}
          onClick={() => toggleStatus('pending')}
        />
        <KPICard
          label="Active NWP"
          value={formatCurrencyCompact(metrics.activeNwp)}
          hint="Net Written Premium across active deals"
          title="Net Written Premium"
          icon={<TrendingUp className="size-4" />}
          active={filters.status === 'active'}
          onClick={() => toggleStatus('active')}
        />
        <KPICard
          label="Active PF EBITDA"
          value={formatCurrencyCompact(metrics.activePfEbitda)}
          hint="Pro forma EBITDA across active deals"
          title="Pro Forma EBITDA"
          icon={<Scale className="size-4" />}
          active={filters.status === 'active'}
          onClick={() => toggleStatus('active')}
        />
        <KPICard
          label="Needs Attention"
          value={String(metrics.attentionCount)}
          hint="Overdue, unowned, stalled or deadline-driven"
          icon={<TriangleAlert className="size-4" />}
          tone="attention"
          active={filters.attentionOnly}
          onClick={toggleAttentionOnly}
        />
      </div>

      <PipelineOverview
        stages={stageSummary}
        selectedStage={filters.stage}
        onSelectStage={toggleStage}
        onClearStage={() => clearFilter('stage')}
        scopeLabel={scopeStatusName}
        totalCount={stageTotals.count}
        totalNwp={stageTotals.nwp}
      />

      <PriorityDealsTable
        deals={priorityDeals}
        totalMatching={matchingDeals.length}
        maxRows={MAX_PRIORITY_ROWS}
        isFiltered={isFiltered}
        onSelect={setSelectedOpportunity}
        onClearFilters={clearFilters}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <PriorityTasks
          tasks={visibleTasks}
          opportunitiesById={opportunitiesById}
          onSelectOpportunity={setSelectedOpportunity}
        />
        <AttentionAlerts
          opportunities={attentionList}
          attentionOnly={filters.attentionOnly}
          onToggleAttentionOnly={toggleAttentionOnly}
          onSelect={setSelectedOpportunity}
        />
        <RecentActivity
          events={visibleActivity}
          opportunitiesById={opportunitiesById}
          onSelect={setSelectedOpportunity}
        />
      </div>

      <DashboardCharts
        statusData={statusChartData}
        stageData={stageSummary}
        selectedStatus={filters.status === ALL_STATUSES ? null : filters.status}
        selectedStage={filters.stage}
        stageScopeLabel={scopeStatusName}
        onSelectStatus={toggleStatus}
        onSelectStage={toggleStage}
      />

      <NewportAI
        context={{
          statusFilter: filters.status === ALL_STATUSES ? 'All Deals' : scopeStatusName,
          visibleOpportunities: matchingDeals.length,
          needsAttention: attentionList.length,
        }}
      />

      <p className="pb-2 text-center text-[11px] text-slate-400">
        Demo dataset — fictional projects, companies and figures for prototype review only.
      </p>

      <OpportunityDrawer
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
      />
    </div>
  );
}

function ActiveFilters({
  onClear,
  onClearAll,
}: {
  onClear: (dimension: FilterDimension) => void;
  onClearAll: () => void;
}) {
  const { filters } = useDashboardFilters();
  const chips = describeFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Filtered by
      </span>
      {chips.map((chip) => (
        <button
          key={chip.dimension}
          type="button"
          onClick={() => onClear(chip.dimension)}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-white px-2.5 py-1 text-xs font-medium text-navy-800 transition-colors hover:border-navy-300 hover:bg-navy-50"
        >
          {chip.label}
          <X className="size-3 text-slate-400" />
        </button>
      ))}
      <Button size="sm" variant="ghost" onClick={onClearAll}>
        Clear Filters
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 lg:px-8">
      <div className="h-11 w-full max-w-xl animate-pulse rounded-xl bg-white" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[116px] animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="h-[220px] animate-pulse rounded-2xl bg-white" />
      <div className="h-[360px] animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
