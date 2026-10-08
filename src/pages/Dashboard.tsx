import { useMemo, useState, useCallback } from 'react'
import { TopHeader } from '@/components/layout/TopHeader'
import { StatusFilter } from '@/components/dashboard/StatusFilter'
import { KPIRow } from '@/components/dashboard/KPIRow'
import { PipelineOverview } from '@/components/dashboard/PipelineOverview'
import { PriorityDealsTable } from '@/components/dashboard/PriorityDealsTable'
import { PriorityTasks } from '@/components/dashboard/PriorityTasks'
import { AttentionAlerts } from '@/components/dashboard/AttentionAlerts'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { NewportAI } from '@/components/dashboard/NewportAI'
import { ExcelImportModal } from '@/components/dashboard/ExcelImportModal'
import { OpportunityDrawer } from '@/components/dashboard/OpportunityDrawer'
import { mockActivity, mockAlerts, mockPriorityTasks } from '@/data/mockTasks'
import { DEMO_DISCLAIMER } from '@/data/constants'
import { useData } from '@/data/DataContext'
import { getStoredSession } from '@/lib/api'
import { loadDemoCollection, saveDemoCollection } from '@/lib/demoStore'
import { mockContacts, mockTasksDb } from '@/data/mockModules'
import type { ImportRow } from '@/lib/excelImport'
import type { AcquisitionStage, DashboardFilters, Opportunity } from '@/types'
import {
  computeDealsByStatus,
  computeKpis,
  computePipelineByStage,
  filterOpportunities,
  hasActiveFilters,
} from '@/utils/dashboard'

const DEFAULT_FILTERS: DashboardFilters = {
  status: 'All Deals',
  stage: null,
  search: '',
}

export function Dashboard() {
  const { opportunities, createOpportunity, saveOpportunity } = useData()
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [excelOpen, setExcelOpen] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const filtered = useMemo(
    () => filterOpportunities(opportunities, filters),
    [filters, opportunities],
  )

  /** Pipeline / KPIs use a broader set when status filter is active stages matter */
  const pipelineSource = useMemo(() => {
    // Pipeline should focus on Active + Pending for M&A view unless filtering Needs Attention
    if (filters.status === 'Needs Attention') {
      return opportunities.filter((o) => o.needsAttention)
    }
    if (filters.status === 'All Deals') {
      return opportunities.filter(
        (o) => o.status === 'Active' || o.status === 'Pending',
      )
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
    // Executive KPIs always reflect full book unless searching
    const base = filters.search.trim()
      ? filterOpportunities(opportunities, {
          status: 'All Deals',
          stage: null,
          search: filters.search,
        })
      : opportunities
    return computeKpis(base)
  }, [filters.search, opportunities])

  const pipeline = useMemo(
    () => computePipelineByStage(pipelineFiltered),
    [pipelineFiltered],
  )

  const chartOpportunities = useMemo(() => {
    // Charts respond to status + search (not stage) so stage filter remains table-focused
    return filterOpportunities(opportunities, {
      status: filters.status,
      stage: null,
      search: filters.search,
    })
  }, [filters.status, filters.search, opportunities])

  const byStatus = useMemo(
    () => computeDealsByStatus(chartOpportunities),
    [chartOpportunities],
  )

  const byStage = useMemo(() => {
    const activeLike =
      filters.status === 'All Deals' || filters.status === 'Active'
        ? chartOpportunities.filter((o) => o.status === 'Active')
        : chartOpportunities
    return computePipelineByStage(activeLike).map(({ stage, count }) => ({
      stage,
      count,
    }))
  }, [chartOpportunities, filters.status])

  /** Priority table: show filtered set, prefer Active/Pending when viewing all */
  const tableRows = useMemo(() => {
    let rows = filtered
    if (filters.status === 'All Deals' && !filters.stage && !filters.search.trim()) {
      rows = opportunities.filter(
        (o) => o.status === 'Active' || o.status === 'Pending',
      )
    }
    return [...rows]
      .sort((a, b) => {
        const pri = { A: 0, B: 1, C: 2 }
        if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority]
        if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
        return a.projectName.localeCompare(b.projectName)
      })
      .slice(0, 8)
  }, [filtered, filters, opportunities])

  const setStatus = (status: DashboardFilters['status']) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === status && status !== 'All Deals' ? 'All Deals' : status,
      // Clear stage when switching broad status chips for clarity
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
        onNewOpportunity={() =>
          showToast('New Opportunity workflow — coming in a future sprint')
        }
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
            <PriorityTasks tasks={mockPriorityTasks} onProjectClick={openById} />
            <AttentionAlerts
              alerts={mockAlerts}
              onProjectClick={openById}
              onViewAll={() => setStatus('Needs Attention')}
            />
          </div>

          <DashboardCharts byStatus={byStatus} byStage={byStage} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RecentActivity items={mockActivity} />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-2">
              <QuickActions
                onAction={(action) => {
                  if (action === 'import-excel') {
                    setExcelOpen(true)
                    return
                  }
                  if (action === 'new-opportunity') {
                    showToast('Use Import Excel or Opportunities → create from a deal record')
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
          if (getStoredSession()?.token === 'local-demo') {
            const existing = loadDemoCollection('tasks', mockTasksDb)
            const mapped = rows.map((r, i) => ({
              id: `task_import_${Date.now()}_${i}`,
              priority: String(r.priority ?? 'B'),
              action: String(r.action ?? r.nextAction ?? r.name ?? `Imported task ${i + 1}`),
              opportunityId: null,
              projectName: String(r.projectName ?? ''),
              owner: String(r.dealLead ?? r.owner ?? 'Dennis'),
              dueDate: r.nextActionDate != null ? String(r.nextActionDate) : null,
              status: 'Open',
              notes: String(r.notes ?? 'Excel import'),
            }))
            saveDemoCollection('tasks', [...mapped, ...existing])
            return
          }
          const token = getStoredSession()?.token
          for (const r of rows) {
            await fetch('/api/resources/tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                action: String(r.action ?? r.nextAction ?? r.name ?? 'Imported task'),
                priority: String(r.priority ?? 'B'),
                owner: String(r.dealLead ?? r.owner ?? ''),
                projectName: String(r.projectName ?? ''),
                dueDate: r.nextActionDate != null ? String(r.nextActionDate) : null,
                status: 'Open',
                notes: String(r.notes ?? 'Excel import'),
              }),
            })
          }
        }}
        onImportContacts={async (rows: ImportRow[]) => {
          if (getStoredSession()?.token === 'local-demo') {
            const existing = loadDemoCollection('contacts', mockContacts)
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
            saveDemoCollection('contacts', [...mapped, ...existing])
            return
          }
          const token = getStoredSession()?.token
          for (const r of rows) {
            await fetch('/api/resources/contacts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                name: String(r.name ?? r.entityName ?? 'Imported contact'),
                title: String(r.title ?? ''),
                company: String(r.company ?? ''),
                email: String(r.email ?? ''),
                phone: String(r.phone ?? ''),
                projectName: String(r.projectName ?? ''),
                status: 'Active',
                notes: String(r.notes ?? 'Excel import'),
              }),
            })
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
