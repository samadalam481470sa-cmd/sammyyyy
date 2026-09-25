import React, { useState, useMemo } from 'react'
import { Opportunity, OpportunityStatus, OpportunityStage, PriorityTask, AttentionAlert, ActivityItem } from '../types/crm'
import { MOCK_OPPORTUNITIES, MOCK_PRIORITY_TASKS, MOCK_ATTENTION_ALERTS, MOCK_ACTIVITIES } from '../data/mockData'
import { OPPORTUNITY_STATUSES } from '../types/constants'
import { StatusFilter } from './dashboard/StatusFilter'
import { KPICardsRow } from './dashboard/KPICardsRow'
import { AcquisitionPipeline } from './dashboard/AcquisitionPipeline'
import { PriorityDealsTable } from './dashboard/PriorityDealsTable'
import { PriorityTasks } from './dashboard/PriorityTasks'
import { AttentionAlerts } from './dashboard/AttentionAlerts'
import { DashboardCharts } from './dashboard/DashboardCharts'
import { RecentActivity } from './dashboard/RecentActivity'
import { QuickActions } from './dashboard/QuickActions'
import { NewportAI } from './dashboard/NewportAI'
import { OpportunityDrawer } from './dashboard/OpportunityDrawer'
import { NewOpportunityModal } from './dashboard/NewOpportunityModal'

interface DashboardProps {
  searchQuery: string
  isNewOpportunityOpen: boolean
  onCloseNewOpportunity: () => void
  onOpenNewOpportunity: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  searchQuery,
  isNewOpportunityOpen,
  onCloseNewOpportunity,
  onOpenNewOpportunity,
}) => {
  // Master opportunities state (allows new deals created during demo)
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES)
  const [tasks] = useState<PriorityTask[]>(MOCK_PRIORITY_TASKS)
  const [alerts] = useState<AttentionAlert[]>(MOCK_ATTENTION_ALERTS)
  const [activities] = useState<ActivityItem[]>(MOCK_ACTIVITIES)

  // Interactive filters
  const [selectedStatus, setSelectedStatus] = useState<OpportunityStatus | 'All Deals'>('Active')
  const [selectedStage, setSelectedStage] = useState<OpportunityStage | null>(null)
  const [needsAttentionFilterActive, setNeedsAttentionFilterActive] = useState(false)

  // Drawer modal state
  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Simple feedback notification toast for non-implemented actions
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Handle deal selection (opens side drawer)
  const handleSelectDeal = (deal: Opportunity) => {
    setSelectedDeal(deal)
    setIsDrawerOpen(true)
  }

  const handleSelectProjectById = (projectId: string) => {
    const found = opportunities.find((o) => o.id === projectId)
    if (found) {
      handleSelectDeal(found)
    }
  }

  // Handle adding new opportunity
  const handleSaveNewOpportunity = (newOppData: Partial<Opportunity>) => {
    const newDeal: Opportunity = {
      id: `opp-${Date.now()}`,
      projectName: newOppData.projectName || 'Project New',
      entityName: newOppData.entityName || 'New Target Entity',
      type: newOppData.type || 'Platform Acquisition',
      status: newOppData.status || 'Active',
      stage: newOppData.stage || 'Target Identified',
      dealLead: newOppData.dealLead || 'Dennis DiCapua',
      sourceType: newOppData.sourceType || 'Investment Banker',
      sourceName: newOppData.sourceName || 'Stonemark Partners',
      specialty: newOppData.specialty || 'Commercial Specialty',
      geography: newOppData.geography || 'National',
      nwp: newOppData.nwp || 20000000,
      netRevenue: newOppData.netRevenue || 3500000,
      pfEbitda: newOppData.pfEbitda || 2500000,
      nextAction: newOppData.nextAction || 'Review preliminary CIM',
      nextActionDate: newOppData.nextActionDate || '2026-10-15',
      priority: newOppData.priority || 'A',
      lastActivityDate: '2026-09-25',
      needsAttention: false,
    }

    setOpportunities([newDeal, ...opportunities])
    showToast(`Created new confidential file for ${newDeal.projectName}`)
  }

  // KPI calculations based on current dataset
  const activeOpportunities = opportunities.filter((o) => o.status === 'Active')
  const pendingOpportunities = opportunities.filter((o) => o.status === 'Pending')
  
  const activeDealsCount = activeOpportunities.length
  const pendingDealsCount = pendingOpportunities.length
  const activeNwpTotal = activeOpportunities.reduce((sum, o) => sum + o.nwp, 0)
  const activePfEbitdaTotal = activeOpportunities.reduce((sum, o) => sum + o.pfEbitda, 0)
  
  // Needs attention opportunities (Active or Pending)
  const needsAttentionDeals = opportunities.filter((o) => o.needsAttention)
  const needsAttentionCount = needsAttentionDeals.length

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<OpportunityStatus | 'All Deals', number> = {
      'All Deals': opportunities.length,
      'Active': 0,
      'Pending': 0,
      'Inactive': 0,
      'Closed': 0,
      'Declined': 0,
      'Withdrew': 0,
      'Completed': 0,
    }

    OPPORTUNITY_STATUSES.forEach((s) => {
      counts[s] = opportunities.filter((o) => o.status === s).length
    })

    return counts
  }, [opportunities])

  // Filtered deals for Priority Deals Table
  const filteredDeals = useMemo(() => {
    return opportunities.filter((deal) => {
      // Search query filter (search by project, entity, lead, specialty)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesProject = deal.projectName.toLowerCase().includes(query)
        const matchesEntity = deal.entityName.toLowerCase().includes(query)
        const matchesLead = deal.dealLead.toLowerCase().includes(query)
        const matchesSpecialty = deal.specialty.toLowerCase().includes(query)
        if (!matchesProject && !matchesEntity && !matchesLead && !matchesSpecialty) {
          return false
        }
      }

      // Needs Attention button override
      if (needsAttentionFilterActive) {
        return deal.needsAttention
      }

      // Broad Status filter
      if (selectedStatus !== 'All Deals') {
        if (deal.status !== selectedStatus) return false
      }

      // Acquisition Stage filter (e.g. clicking NDA, Diligence, etc.)
      if (selectedStage) {
        if (deal.stage !== selectedStage) return false
      }

      return true
    })
  }, [opportunities, searchQuery, selectedStatus, selectedStage, needsAttentionFilterActive])

  // Filter Action Handlers
  const handleSelectActiveDeals = () => {
    setSelectedStatus('Active')
    setSelectedStage(null)
    setNeedsAttentionFilterActive(false)
  }

  const handleSelectPendingDeals = () => {
    setSelectedStatus('Pending')
    setSelectedStage(null)
    setNeedsAttentionFilterActive(false)
  }

  const handleSelectNeedsAttention = () => {
    setNeedsAttentionFilterActive(true)
    setSelectedStage(null)
  }

  const handleClearAllFilters = () => {
    setSelectedStatus('All Deals')
    setSelectedStage(null)
    setNeedsAttentionFilterActive(false)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center space-x-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Global Status Filter */}
      <StatusFilter
        selectedStatus={selectedStatus}
        onSelectStatus={(status) => {
          setSelectedStatus(status)
          setNeedsAttentionFilterActive(false)
        }}
        statusCounts={statusCounts}
        activeStageFilter={selectedStage}
        onClearAllFilters={handleClearAllFilters}
        needsAttentionFilterActive={needsAttentionFilterActive}
      />

      {/* 2. Executive KPI Cards */}
      <KPICardsRow
        activeDealsCount={activeDealsCount}
        pendingDealsCount={pendingDealsCount}
        activeNwpTotal={activeNwpTotal}
        activePfEbitdaTotal={activePfEbitdaTotal}
        needsAttentionCount={needsAttentionCount}
        selectedStatus={selectedStatus}
        needsAttentionActive={needsAttentionFilterActive}
        onSelectActiveDeals={handleSelectActiveDeals}
        onSelectPendingDeals={handleSelectPendingDeals}
        onSelectNeedsAttention={handleSelectNeedsAttention}
      />

      {/* 3. Primary Section: Acquisition Pipeline */}
      <AcquisitionPipeline
        opportunities={opportunities}
        selectedStage={selectedStage}
        onSelectStage={(stage) => {
          setSelectedStage(stage)
          if (stage && selectedStatus !== 'Active') {
            // Stage is primarily active deal progression
            setSelectedStatus('Active')
          }
          setNeedsAttentionFilterActive(false)
        }}
      />

      {/* 4. Priority / Active Deals Table */}
      <PriorityDealsTable
        deals={filteredDeals}
        onSelectDeal={handleSelectDeal}
        totalCount={opportunities.length}
      />

      {/* 5. Priorities, Alerts & Activity 3-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        <PriorityTasks
          tasks={tasks}
          onSelectProject={handleSelectProjectById}
        />
        <AttentionAlerts
          alerts={alerts}
          onSelectProject={handleSelectProjectById}
        />
        <RecentActivity
          activities={activities}
          onSelectProject={handleSelectProjectById}
        />
      </div>

      {/* 6. Executive Analytics Charts (Status & Stage distributions) */}
      <DashboardCharts
        opportunities={opportunities}
        onSelectStatus={(st) => {
          setSelectedStatus(st as OpportunityStatus)
          setSelectedStage(null)
          setNeedsAttentionFilterActive(false)
        }}
        onSelectStage={(stg) => {
          setSelectedStage(stg as OpportunityStage)
          setSelectedStatus('Active')
          setNeedsAttentionFilterActive(false)
        }}
      />

      {/* 7. Newport AI Assistant */}
      <NewportAI
        onExecutePrompt={(prompt) => {
          if (prompt.includes('attention')) {
            handleSelectNeedsAttention()
          } else if (prompt.includes('Guardian')) {
            const guardian = opportunities.find((o) => o.projectName.includes('Guardian'))
            if (guardian) handleSelectDeal(guardian)
          }
        }}
      />

      {/* 8. Quick Actions Bar */}
      <QuickActions
        onNewOpportunity={onOpenNewOpportunity}
        onAddTask={() => showToast('Add Task modal will be available in next sprint')}
        onLogActivity={() => showToast('Log Activity workflow will be available in next sprint')}
        onImportExcel={() => showToast('Excel/CSV Pipeline Importer configured for future release')}
      />

      {/* Opportunity Detail Drawer */}
      <OpportunityDrawer
        deal={selectedDeal}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedDeal(null)
        }}
      />

      {/* New Opportunity Modal */}
      <NewOpportunityModal
        isOpen={isNewOpportunityOpen}
        onClose={onCloseNewOpportunity}
        onSave={handleSaveNewOpportunity}
      />
    </div>
  )
}
