import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ExcelImportModal } from '@/components/dashboard/ExcelImportModal'
import { OpportunityDrawer } from '@/components/dashboard/OpportunityDrawer'
import { OpportunityCreateForm } from '@/components/shared/OpportunityCreateForm'
import { DEMO_DISCLAIMER } from '@/data/constants'
import { useData } from '@/data/DataContext'
import { useAuth } from '@/auth/AuthContext'
import { isLocalPersistence } from '@/lib/persistenceMode'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { mockContacts } from '@/data/mockModules'
import type { ImportRow } from '@/lib/excelImport'
import type {
  AcquisitionStage,
  ActivityItem,
  DashboardFilters,
  Opportunity,
  PriorityTask,
} from '@/types'
import {
  computeFinancialTotals,
  computeKpis,
  computePipelineByStage,
  filterDashboardOpportunities,
  hasActiveFilters,
} from '@/utils/dashboard'
import {
  rankOpportunitiesByNextAction,
  topAttentionAlerts,
  uniqueAttentionCount,
} from '@/lib/attention'
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
    createOpportunity,
    saveOpportunity,
    createTask,
  } = useData()
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)
  const navigate = useNavigate()
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [excelOpen, setExcelOpen] = useState(false)
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

  const weekTasks = useMemo<PriorityTask[]>(() => {
    return rankWeekPriorityTasks(tasks)
      .slice(0, 5)
      .map((task) => ({
        id: task.id,
        priority: (task.priority === 'A' || task.priority === 'B' || task.priority === 'C'
          ? task.priority
          : 'B') as PriorityTask['priority'],
        action: task.action,
        projectId: task.opportunityId || '',
        projectName: task.projectName,
        owner: task.owner,
        dueDate: task.dueDate || '',
      }))
  }, [tasks])

  const recentActivity = useMemo(
    () =>
      [...activity]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5),
    [activity],
  )

  const allActivity = useMemo(
    () => [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activity],
  )

  const alerts = useMemo(() => topAttentionAlerts(opportunities, tasks, 5), [opportunities, tasks])
  const uniqueAlerts = useMemo(
    () => uniqueAttentionCount(opportunities, tasks),
    [opportunities, tasks],
  )

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

      <main className="flex-1 px-6 py-6 lg:px-8">
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

          <div className="grid gap-4 lg:grid-cols-2">
            <PriorityTasks
              tasks={weekTasks}
              onProjectClick={openById}
              onViewAll={() => void navigate('/tasks')}
            />
            <AttentionAlerts
              alerts={alerts}
              uniqueDealCount={uniqueAlerts}
              onProjectClick={openById}
              onViewAll={() => void navigate('/opportunities?attention=1')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RecentActivity
                items={recentActivity}
                allItems={allActivity}
                onViewAll={() => setActivityOpen(true)}
                onItemClick={openActivity}
                historyOpen={activityOpen}
                onCloseHistory={() => setActivityOpen(false)}
              />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-2">
              <QuickActions
                onAction={(action) => {
                  if (action === 'import-excel') {
                    setExcelOpen(true)
                    return
                  }
                  if (action === 'new-opportunity') {
                    setCreateOpen(true)
                    return
                  }
                  if (action === 'add-task') {
                    void navigate('/tasks?new=1')
                    return
                  }
                  showToast(`${action.replace(/-/g, ' ')} — open the matching module to continue`)
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

      <ExcelImportModal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        opportunities={opportunities}
        onCreateOpportunities={async (drafts) => {
          for (const d of drafts) {
            await createOpportunity(d)
          }
          showToast(`Imported ${drafts.length} opportunit${drafts.length === 1 ? 'y' : 'ies'}`)
        }}
        onUpdateOpportunity={async (id, patch) => {
          await saveOpportunity(id, patch)
          showToast('Opportunity autofilled from Excel')
        }}
        onImportTasks={async (rows: ImportRow[]) => {
          for (const [i, r] of rows.entries()) {
            await createTask({
              action: String(r.action ?? r.nextAction ?? r.name ?? `Imported task ${i + 1}`),
              priority: String(r.priority ?? 'B'),
              owner: String(r.dealLead ?? r.owner ?? ''),
              projectName: String(r.projectName ?? ''),
              dueDate: r.nextActionDate != null ? String(r.nextActionDate) : null,
              status: 'Open',
              notes: String(r.notes ?? 'Excel import'),
            })
          }
        }}
        onImportContacts={async (rows: ImportRow[]) => {
          if (isLocalPersistence()) {
            const existing = loadOwnedCollection('contacts', owner, mockContacts)
            const mapped = rows.map((r, i) => ({
              id: `con_import_${Date.now()}_${i}`,
              name: String(r.name ?? r.entityName ?? `Contact ${i + 1}`),
              title: String(r.title ?? ''),
              company: String(r.company ?? r.entityName ?? ''),
              category: 'Other',
              email: String(r.email ?? ''),
              phone: String(r.phone ?? ''),
              opportunityId: null,
              projectName: String(r.projectName ?? ''),
              status: 'Active',
              lastContactDate: null,
              notes: String(r.notes ?? 'Excel import'),
            }))
            saveOwnedCollection('contacts', owner, [...mapped, ...existing])
          }
        }}
      />

      <OpportunityDrawer opportunity={selected} onClose={() => setSelected(null)} />

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
