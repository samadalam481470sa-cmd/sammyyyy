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
import { getStoredSession } from '@/lib/api'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { mockContacts } from '@/data/mockModules'
import type { ImportRow } from '@/lib/excelImport'
import type { AcquisitionStage, DashboardFilters, Opportunity, PriorityTask } from '@/types'
import {
  computeKpis,
  computePipelineByStage,
  filterOpportunities,
  hasActiveFilters,
} from '@/utils/dashboard'
import {
  rankOpportunitiesByNextAction,
  topAttentionAlerts,
  uniqueAttentionCount,
} from '@/lib/attention'
import { isActiveListTask, isUnfinishedTask } from '@/lib/taskLifecycle'
import { dueDateSortValue, isWithinNextDays, isOverdueDate } from '@/lib/calendarDate'

const DEFAULT_FILTERS: DashboardFilters = {
  status: 'All Deals',
  stage: null,
  search: '',
}

export function Dashboard() {
  const {
    opportunities,
    tasks,
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

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const filtered = useMemo(
    () => filterOpportunities(opportunities, filters),
    [filters, opportunities],
  )

  const pipelineSource = useMemo(() => {
    if (filters.status === 'Needs Attention') {
      return opportunities.filter((o) => o.needsAttention)
    }
    if (filters.status === 'All Deals') {
      return opportunities.filter((o) => o.status === 'Active' || o.status === 'Pending')
    }
    return opportunities.filter((o) => o.status === filters.status)
  }, [filters.status, opportunities])

  const pipelineFiltered = useMemo(() => {
    if (!filters.search.trim()) return pipelineSource
    const q = filters.search.trim().toLowerCase()
    return pipelineSource.filter((o) =>
      `${o.projectName} ${o.entityName} ${o.dealLead}`.toLowerCase().includes(q),
    )
  }, [pipelineSource, filters.search])

  const kpis = useMemo(() => {
    const base = filters.search.trim()
      ? filterOpportunities(opportunities, {
          status: 'All Deals',
          stage: null,
          search: filters.search,
        })
      : opportunities
    return {
      ...computeKpis(base),
      needsAttention: uniqueAttentionCount(base, tasks),
    }
  }, [filters.search, opportunities, tasks])

  const pipeline = useMemo(
    () => computePipelineByStage(pipelineFiltered),
    [pipelineFiltered],
  )

  const tableRows = useMemo(() => {
    let rows = filtered
    if (filters.status === 'All Deals' && !filters.stage && !filters.search.trim()) {
      rows = opportunities.filter((o) => o.status === 'Active' || o.status === 'Pending')
    }
    return rankOpportunitiesByNextAction(rows, tasks).slice(0, 8)
  }, [filtered, filters, opportunities, tasks])

  const weekTasks = useMemo<PriorityTask[]>(() => {
    return tasks
      .filter((task) => isActiveListTask(task) && isUnfinishedTask(task))
      .filter((task) => !task.dueDate || isOverdueDate(task.dueDate) || isWithinNextDays(task.dueDate, 7))
      .sort((a, b) => dueDateSortValue(a.dueDate) - dueDateSortValue(b.dueDate))
      .slice(0, 6)
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
            <PriorityTasks tasks={weekTasks} onProjectClick={openById} />
            <AttentionAlerts
              alerts={alerts}
              uniqueDealCount={uniqueAlerts}
              onProjectClick={openById}
              onViewAll={() => setStatus('Needs Attention')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RecentActivity items={activity.slice(0, 12)} />
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
          if (getStoredSession()?.token === 'local-demo') {
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
