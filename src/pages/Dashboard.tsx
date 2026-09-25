import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Briefcase, Clock, DollarSign } from 'lucide-react';
import TopHeader, { NewOpportunityModal } from '../components/layout/TopHeader';
import StatusFilter from '../components/dashboard/StatusFilter';
import KPICard from '../components/dashboard/KPICard';
import PipelineOverview from '../components/dashboard/PipelineOverview';
import PriorityDealsTable from '../components/dashboard/PriorityDealsTable';
import PriorityTasks from '../components/dashboard/PriorityTasks';
import AttentionAlerts from '../components/dashboard/AttentionAlerts';
import DashboardCharts from '../components/dashboard/DashboardCharts';
import RecentActivity from '../components/dashboard/RecentActivity';
import QuickActions from '../components/dashboard/QuickActions';
import NewportAI from '../components/dashboard/NewportAI';
import OpportunityDrawer from '../components/dashboard/OpportunityDrawer';
import Modal from '../components/common/Modal';
import { useOpportunities } from '../hooks/useOpportunities';
import { usePriorityTasks } from '../hooks/usePriorityTasks';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { computeDashboardKpis } from '../lib/kpis';
import { formatCount, formatUsdCompact } from '../lib/format';
import type { Opportunity } from '../types/opportunity';

export default function Dashboard() {
  const { opportunities } = useOpportunities();
  const tasks = usePriorityTasks();
  const activity = useRecentActivity();

  const filters = useDashboardFilters(opportunities);
  const kpis = useMemo(() => computeDashboardKpis(opportunities), [opportunities]);

  const activePipelineOpportunities = useMemo(
    () => filters.searchedOpportunities.filter((o) => o.status === 'Active'),
    [filters.searchedOpportunities],
  );

  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-6 pb-10 lg:px-8">
      <TopHeader
        search={filters.search}
        onSearchChange={filters.setSearch}
        onNewOpportunity={() => setNewOpportunityOpen(true)}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <StatusFilter value={filters.statusFilter} onChange={filters.setStatusFilter} />
        {filters.hasActiveFilters && (
          <button
            type="button"
            onClick={filters.clearFilters}
            className="text-sm font-medium text-accent-700 transition-colors hover:text-accent-800 hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <KPICard
          label="Active Deals"
          value={formatCount(kpis.activeDealCount)}
          icon={Briefcase}
          helpText="Currently being worked"
          active={filters.statusFilter === 'Active'}
          onClick={() => filters.setStatusFilter('Active')}
        />
        <KPICard
          label="Pending Deals"
          value={formatCount(kpis.pendingDealCount)}
          icon={Clock}
          helpText="Awaiting qualification"
          active={filters.statusFilter === 'Pending'}
          onClick={() => filters.setStatusFilter('Pending')}
        />
        <KPICard
          label="Active NWP"
          value={formatUsdCompact(kpis.activeNwpTotal)}
          icon={DollarSign}
          helpText="Net written premium"
        />
        <KPICard
          label="Active PF EBITDA"
          value={formatUsdCompact(kpis.activePfEbitdaTotal)}
          icon={Activity}
          helpText="Pro forma EBITDA"
        />
        <KPICard
          label="Needs Attention"
          value={formatCount(kpis.needsAttentionCount)}
          icon={AlertTriangle}
          helpText="Overdue, stalled, or unowned"
          emphasis
          active={filters.attentionOnly}
          onClick={filters.toggleAttentionOnly}
        />
      </div>

      <div className="mt-6">
        <PipelineOverview
          opportunities={activePipelineOpportunities}
          selectedStage={filters.stageFilter}
          onSelectStage={filters.selectStage}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PriorityDealsTable opportunities={filters.filteredOpportunities} onSelectOpportunity={setSelectedOpportunity} />
        </div>
        <div>
          <AttentionAlerts
            opportunities={opportunities}
            attentionOnly={filters.attentionOnly}
            onToggleAttentionOnly={filters.toggleAttentionOnly}
            onSelectOpportunity={setSelectedOpportunity}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          <PriorityTasks tasks={tasks} />
        </div>
        <div className="lg:col-span-2">
          <DashboardCharts opportunities={filters.filteredOpportunities} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity activity={activity} />
        </div>
        <div className="flex flex-col gap-4">
          <QuickActions
            onAction={(action) => (action === 'New Opportunity' ? setNewOpportunityOpen(true) : setQuickActionNotice(action))}
          />
          <NewportAI />
        </div>
      </div>

      <OpportunityDrawer opportunity={selectedOpportunity} onClose={() => setSelectedOpportunity(null)} />
      <NewOpportunityModal open={newOpportunityOpen} onClose={() => setNewOpportunityOpen(false)} />
      <Modal
        open={quickActionNotice !== null}
        onClose={() => setQuickActionNotice(null)}
        title={quickActionNotice ?? ''}
      >
        This action will be fully connected in a future sprint. For now it&apos;s a preview of what&apos;s coming to
        Newport&apos;s acquisition CRM.
      </Modal>
    </div>
  );
}
