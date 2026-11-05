import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { TopHeader } from '@/components/layout/TopHeader'
import { StatusFilter } from '@/components/dashboard/StatusFilter'
import { KPIRow } from '@/components/dashboard/KPIRow'
import { PipelineOverview } from '@/components/dashboard/PipelineOverview'
import { PriorityDealsTable } from '@/components/dashboard/PriorityDealsTable'
import { PriorityTasks } from '@/components/dashboard/PriorityTasks'
import { AttentionAlerts } from '@/components/dashboard/AttentionAlerts'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { NewportAI } from '@/components/dashboard/NewportAI'
import { OpportunityDrawer } from '@/components/dashboard/OpportunityDrawer'
import { NewTaskDrawer } from '@/components/tasks/NewTaskDrawer'
import { NewRelationshipDrawer } from '@/components/relationships/NewRelationshipDrawer'
import { OpportunityCreateForm } from '@/components/shared/OpportunityCreateForm'
import { DEMO_DISCLAIMER } from '@/data/constants'
import { useData } from '@/data/DataContext'
import { useAuth } from '@/auth/AuthContext'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { NewDealLeadModal } from '@/components/dealLeads/NewDealLeadModal'
import { useDealLeads } from '@/hooks/useDealLeads'
import type {
  AcquisitionStage,
  ActivityItem,
  DashboardFilters,
  Opportunity,
} from '@/types'
import {
  computeFinancialTotals,
  computeKpis,
  computePipelineByStage,
  filterDashboardOpportunities,
  hasActiveFilters,
} from '@/utils/dashboard'
import { attentionRows, rankOpportunitiesByNextAction, uniqueAttentionCount } from '@/lib/attention'
import { useRestorableSelection, useRestoringFromProfile, useSessionState } from '@/hooks/useSessionState'
import { useActivityArchive } from '@/lib/activityArchive'
import { rankWeekPriorityTasks } from '@/lib/taskSort'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const DEFAULT_FILTERS: DashboardFilters = {
  status: 'All Deals',
  stage: null,
  search: '',
}

export function Dashboard() {
  const {
    opportunities,
    tasks,
    documents,
    activity,
  } = useData()
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)
  const navigate = useNavigate()
  const [filters, setFilters] = useSessionState<DashboardFilters>('dashboard:filters', DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useRestorableSelection('dashboard')
  const location = useLocation()
  const navigationType = useNavigationType()
  const resetKey = (location.state as { resetDashboard?: number } | null)?.resetDashboard
  // The logo: back to All Deals with no stale selection, also when already on the Dashboard.
  useEffect(() => {
    if (!resetKey || navigationType === 'POP') return
    setFilters(DEFAULT_FILTERS)
    setSelectedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])
  const roster = useDealLeads()
  const [leadModal, setLeadModal] = useState<'create' | 'self' | null>(null)
  const selected = selectedId ? (opportunities.find((o) => o.id === selectedId) ?? null) : null
  const setSelected = (opp: Opportunity | null) => setSelectedId(opp?.id ?? null)
  const activityArchive = useActivityArchive(owner)
  const restoring = useRestoringFromProfile()
  // Dashboard is the one page that scrolls: Back from a profile returns to the same scroll position.
  useEffect(() => {
    if (restoring) {
      try {
        const top = Number(sessionStorage.getItem('newport_view_state:dashboard:scroll') ?? 0)
        requestAnimationFrame(() => window.scrollTo({ top }))
      } catch {
        // ignore
      }
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem('newport_view_state:dashboard:scroll', String(window.scrollY))
      } catch {
        // ignore
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [taskOpen, setTaskOpen] = useState(false)
  const [relationshipOpen, setRelationshipOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityNotice, setActivityNotice] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const filtered = useMemo(
    () => filterDashboardOpportunities(opportunities, filters),
    [filters, opportunities],
  )

  const counts = useMemo(() => computeKpis(opportunities), [opportunities])
  const finances = useMemo(() => computeFinancialTotals(filtered), [filtered])

  const kpis = useMemo(
    () => ({
      activeDeals: counts.activeDeals,
      pendingDeals: counts.pendingDeals,
      nwp: finances.nwp,
      pfEbitda: finances.pfEbitda,
      needsAttention: uniqueAttentionCount(opportunities, tasks),
    }),
    [counts.activeDeals, counts.pendingDeals, finances.nwp, finances.pfEbitda, opportunities, tasks],
  )

  const pipeline = useMemo(() => computePipelineByStage(filtered), [filtered])

  const tableRows = useMemo(
    () => rankOpportunitiesByNextAction(filtered, tasks).slice(0, 8),
    [filtered, tasks],
  )

  // Same eligibility as Tasks & Follow-Ups (paused tasks of inactive deals never appear here).
  const weekTasks = useMemo(() => rankWeekPriorityTasks(tasks, new Date(), opportunities).slice(0, 7), [tasks, opportunities])

  const allActivity = useMemo(
    () => [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activity],
  )

  const attention = useMemo(() => attentionRows(opportunities, tasks), [opportunities, tasks])

  const setStatus = (status: DashboardFilters['status']) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === status && status !== 'All Deals' ? 'All Deals' : status,
      stage: status === 'All Deals' ? prev.stage : null,
    }))
  }

  const setStage = (stage: AcquisitionStage | null) => {
    setFilters((prev) => ({ ...prev, stage }))
  }

  const clearFilters = () => setFilters(DEFAULT_FILTERS)

  const openById = (projectId: string) => {
    const opp = opportunities.find((o) => o.id === projectId) ?? null
    setSelected(opp)
  }

  const openActivity = (item: ActivityItem) => {
    const type =
      item.targetType ??
      (item.type === 'task' ? 'task' : item.type === 'document' ? 'document' : 'opportunity')
    const id = item.targetId ?? item.projectId
    if (!id) {
      setActivityNotice('This activity is not linked to a record.')
      return
    }
    if (type === 'opportunity') {
      if (!opportunities.some((row) => row.id === id)) {
        setActivityNotice('This opportunity was deleted and is no longer available.')
        return
      }
      setActivityOpen(false)
      void navigate(`/opportunities?select=${encodeURIComponent(id)}`)
      return
    }
    if (type === 'task') {
      const task = tasks.find((row) => row.id === id)
      if (!task || task.deletedAt) {
        setActivityNotice('This task was deleted and is no longer available.')
        return
      }
      setActivityOpen(false)
      void navigate(`/tasks?select=${encodeURIComponent(id)}`)
      return
    }
    const doc = documents.find((row) => row.id === id)
    if (!doc) {
      setActivityNotice('This document was removed from the CRM.')
      return
    }
    const opportunityId = doc.opportunityId ?? item.projectId
    if (!opportunityId || !opportunities.some((row) => row.id === opportunityId)) {
      setActivityNotice('The linked opportunity for this document is no longer available.')
      return
    }
    setActivityOpen(false)
    void navigate(
      `/documents?select=${encodeURIComponent(opportunityId)}&doc=${encodeURIComponent(id)}`,
    )
  }

  return (
    <>
      <TopHeader
        search={filters.search}
        onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
        onNewOpportunity={() => setCreateOpen(true)}
      />

      <main data-testid="crm-dashboard" className="min-w-0 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
          <StatusFilter
            filters={filters}
            onStatusChange={setStatus}
            onClear={clearFilters}
            hasFilters={hasActiveFilters(filters)}
            resultCount={filtered.length}
          />

          <KPIRow kpis={kpis} filters={filters} onStatusFilter={setStatus} />

          <PipelineOverview
            stages={pipeline}
            selectedStage={filters.stage}
            onSelectStage={setStage}
          />

          <PriorityDealsTable opportunities={tableRows} onSelect={setSelected} />

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <PriorityTasks
              tasks={weekTasks}
              onProjectClick={openById}
              onViewAll={() => void navigate('/tasks?filter=all')}
            />
            <AttentionAlerts rows={attention} onProjectClick={openById} onViewAll={() => void navigate('/opportunities?attention=1')} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RecentActivity
                allItems={allActivity}
                archived={activityArchive.archived}
                onArchive={activityArchive.archive}
                onRestore={activityArchive.restore}
                onArchiveMany={activityArchive.archiveMany}
                onRestoreMany={activityArchive.restoreMany}
                onItemClick={openActivity}
                historyOpen={activityOpen}
                onOpenHistory={() => setActivityOpen(true)}
                onCloseHistory={() => setActivityOpen(false)}
              />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-2">
              <QuickActions
                leadLabel={roster.isAdmin ? 'New Deal Lead' : roster.own ? 'Edit My Deal Lead Profile' : 'Add Myself as Deal Lead'}
                onAction={(action) => {
                  if (action === 'deal-lead') {
                    if (roster.isAdmin) setLeadModal('create')
                    else if (roster.own || roster.claimable) void navigate('/deal-leads?new=self')
                    else setLeadModal('self')
                    return
                  }
                  if (action === 'new-opportunity') {
                    setCreateOpen(true)
                    return
                  }
                  if (action === 'add-task') {
                    setTaskOpen(true)
                    return
                  }
                  if (action === 'new-relationship') {
                    setRelationshipOpen(true)
                  }
                }}
              />
              <NewportAI />
            </div>
          </div>

          <p className="pb-4 text-center text-[11px] text-ink-subtle">{DEMO_DISCLAIMER}</p>
        </div>
      </main>

      <OpportunityCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(opp) => showToast(`Created ${opp.projectName}`)}
      />

      <NewDealLeadModal open={leadModal != null} mode={leadModal ?? 'self'} roster={roster} onClose={() => setLeadModal(null)} onCreated={(lead) => showToast(`Added deal lead: ${lead.name}`)} />

      <OpportunityDrawer opportunity={selected} onClose={() => setSelected(null)} />

      <NewTaskDrawer open={taskOpen} onClose={() => setTaskOpen(false)} onCreated={(task) => showToast(`Created task: ${task.action}`)} />
      <NewRelationshipDrawer
        open={relationshipOpen}
        onClose={() => setRelationshipOpen(false)}
        onCreated={(contact) => showToast(`Created relationship: ${contact.name}`)}
      />

      <ConfirmDialog
        open={Boolean(activityNotice)}
        title="Record unavailable"
        message={activityNotice ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        tone="default"
        onConfirm={() => setActivityNotice(null)}
        onCancel={() => setActivityNotice(null)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-navy-900 px-4 py-2.5 text-sm text-white shadow-(--shadow-elevated)"
        >
          {toast}
        </div>
      )}
    </>
  )
}
