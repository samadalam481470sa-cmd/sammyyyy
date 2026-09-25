import { PRIORITY_TABLE_LIMIT } from "../data/constants.ts"
import {
  ACQUISITION_STAGES,
  OPPORTUNITY_STATUSES,
  type AcquisitionStage,
  type ActivityItem,
  type CrmSnapshot,
  type DashboardFilters,
  type Opportunity,
  type Priority,
  type PriorityTask,
  type StatusFilter,
} from "../types/crm.ts"

export const DEFAULT_FILTERS: DashboardFilters = {
  status: "All",
  stage: null,
  attentionOnly: false,
  search: "",
}

export interface PipelineStageSummary {
  stage: AcquisitionStage
  count: number
  nwp: number
}

export interface ChartPoint {
  label: string
  count: number
}

export interface DashboardModel {
  kpis: {
    activeDeals: number
    pendingDeals: number
    activeNwp: number
    activePfEbitda: number
    needsAttention: number
  }
  pipeline: PipelineStageSummary[]
  pipelineSubtitle: string
  tableRows: Opportunity[]
  tableSubtitle: string
  showViewAllActive: boolean
  tasks: PriorityTask[]
  alerts: Opportunity[]
  activities: ActivityItem[]
  statusChart: ChartPoint[]
  stageChart: ChartPoint[]
  stageChartTitle: string
  filterSummary: string | null
}

export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.status !== "All" ||
    filters.stage !== null ||
    filters.attentionOnly ||
    filters.search.trim().length > 0
  )
}

export function matchesSearch(opportunity: Opportunity, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return [opportunity.projectName, opportunity.entityName, opportunity.dealLead ?? ""].some((value) =>
    value.toLowerCase().includes(query),
  )
}

function priorityRank(priority: Priority | null): number {
  if (priority === "A") return 0
  if (priority === "B") return 1
  if (priority === "C") return 2
  return 3
}

function compareOpportunities(a: Opportunity, b: Opportunity): number {
  if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
  if (byPriority !== 0) return byPriority
  const aDate = a.nextActionDate ?? "9999-99-99"
  const bDate = b.nextActionDate ?? "9999-99-99"
  if (aDate !== bDate) return aDate < bDate ? -1 : 1
  return a.projectName.localeCompare(b.projectName)
}

function compareTasks(a: PriorityTask, b: PriorityTask): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
  if (byPriority !== 0) return byPriority
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  return a.action.localeCompare(b.action)
}

function sum(opportunities: Opportunity[], pick: (opportunity: Opportunity) => number): number {
  return opportunities.reduce((total, opportunity) => total + pick(opportunity), 0)
}

function pipelineCopy(filters: DashboardFilters): { pipelineSubtitle: string; stageChartTitle: string } {
  if (filters.status !== "All" && filters.attentionOnly) {
    return {
      pipelineSubtitle: `${filters.status} opportunities needing attention`,
      stageChartTitle: `${filters.status} Deals by Stage`,
    }
  }
  if (filters.status !== "All") {
    return {
      pipelineSubtitle: `${filters.status} opportunities by acquisition stage`,
      stageChartTitle: `${filters.status} Deals by Stage`,
    }
  }
  if (filters.attentionOnly) {
    return {
      pipelineSubtitle: "Opportunities needing attention, by stage",
      stageChartTitle: "Deals by Stage",
    }
  }
  if (filters.search.trim()) {
    return {
      pipelineSubtitle: "Active opportunities in the current search",
      stageChartTitle: "Active Deals by Stage",
    }
  }
  return {
    pipelineSubtitle: "Active opportunities by acquisition stage",
    stageChartTitle: "Active Deals by Stage",
  }
}

function describeFilters(filters: DashboardFilters, count: number): string | null {
  if (!hasActiveFilters(filters)) return null
  const noun = count === 1 ? "opportunity" : "opportunities"
  const implicitActive = filters.status === "All" && !filters.attentionOnly && filters.stage !== null
  const statusPrefix = implicitActive ? "active " : filters.status === "All" ? "" : `${filters.status.toLowerCase()} `
  let text = `${count} ${statusPrefix}${noun}`
  if (filters.attentionOnly) text += " needing attention"
  if (filters.stage) text += ` in ${filters.stage}`
  if (filters.search.trim()) text += ` matching "${filters.search.trim()}"`
  return text
}

export function buildDashboardModel(snapshot: CrmSnapshot, filters: DashboardFilters): DashboardModel {
  const searchScoped = snapshot.opportunities.filter((opportunity) => matchesSearch(opportunity, filters.search))
  const activeScoped = searchScoped.filter((opportunity) => opportunity.status === "Active")

  const kpis = {
    activeDeals: activeScoped.length,
    pendingDeals: searchScoped.filter((opportunity) => opportunity.status === "Pending").length,
    activeNwp: sum(activeScoped, (opportunity) => opportunity.nwp),
    activePfEbitda: sum(activeScoped, (opportunity) => opportunity.pfEbitda),
    needsAttention: searchScoped.filter((opportunity) => opportunity.needsAttention).length,
  }

  const baseSet = searchScoped.filter((opportunity) => {
    if (filters.status !== "All" && opportunity.status !== filters.status) return false
    if (filters.attentionOnly && !opportunity.needsAttention) return false
    return true
  })

  const defaultView = !hasActiveFilters(filters)
  const ranked = baseSet.slice().sort(compareOpportunities)
  const pipelineSource =
    filters.status === "All" && !filters.attentionOnly
      ? baseSet.filter((opportunity) => opportunity.status === "Active")
      : baseSet
  const stageRows = filters.stage
    ? pipelineSource
        .filter((opportunity) => opportunity.stage === filters.stage)
        .slice()
        .sort(compareOpportunities)
    : null
  const priorityCandidates = ranked.filter(
    (opportunity) => opportunity.status === "Active" || opportunity.needsAttention,
  )
  const tableRows = stageRows ?? (defaultView ? priorityCandidates.slice(0, PRIORITY_TABLE_LIMIT) : ranked)

  const pipeline = ACQUISITION_STAGES.map((stage) => {
    const deals = pipelineSource.filter((opportunity) => opportunity.stage === stage)
    return {
      stage,
      count: deals.length,
      nwp: sum(deals, (opportunity) => opportunity.nwp),
    }
  })

  const statusChart = OPPORTUNITY_STATUSES.map((status) => ({
    label: status,
    count: baseSet.filter((opportunity) => opportunity.status === status).length,
  })).filter((point) => point.count > 0)

  const stageChart = ACQUISITION_STAGES.map((stage) => ({
    label: stage,
    count: pipelineSource.filter((opportunity) => opportunity.stage === stage).length,
  })).filter((point) => point.count > 0 || point.label === filters.stage)

  const alertSource = stageRows ?? baseSet
  const alerts = alertSource.filter((opportunity) => opportunity.needsAttention).sort(compareOpportunities)

  const scopedIds = new Set(alertSource.map((opportunity) => opportunity.id))
  const taskIds = defaultView ? new Set(snapshot.opportunities.map((opportunity) => opportunity.id)) : scopedIds
  const tasks = snapshot.tasks.filter((task) => taskIds.has(task.projectId)).sort(compareTasks)

  const activities = snapshot.activities
    .filter((activity) => scopedIds.has(activity.projectId))
    .slice()
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))

  const filterSummary = describeFilters(filters, tableRows.length)
  const copy = pipelineCopy(filters)
  const activeInTable = tableRows.filter((opportunity) => opportunity.status === "Active").length

  return {
    kpis,
    pipeline,
    pipelineSubtitle: copy.pipelineSubtitle,
    tableRows,
    tableSubtitle: filterSummary ?? "Code name, stage, and the next step for the deals that matter most.",
    showViewAllActive: defaultView && kpis.activeDeals > activeInTable,
    tasks,
    alerts,
    activities,
    statusChart,
    stageChart,
    stageChartTitle: copy.stageChartTitle,
    filterSummary,
  }
}

export function statusFromChartLabel(label: string): StatusFilter | null {
  return OPPORTUNITY_STATUSES.find((status) => status === label) ?? null
}

export function stageFromChartLabel(label: string): AcquisitionStage | null {
  return ACQUISITION_STAGES.find((stage) => stage === label) ?? null
}
