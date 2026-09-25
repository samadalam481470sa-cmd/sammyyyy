import { useState, type ReactNode } from "react"
import { createDemoDataset, warnIfDemoDrift } from "../data/demoData.ts"
import { createActivityRecord, createOpportunityRecord, createTaskRecord } from "../lib/createRecords.ts"
import { DEFAULT_FILTERS, hasActiveFilters } from "../lib/dashboardModel.ts"
import type {
  AcquisitionStage,
  CrmSnapshot,
  DashboardFilters,
  NewActivityInput,
  NewOpportunityInput,
  NewTaskInput,
  StatusFilter,
  WorkspaceModal,
} from "../types/crm.ts"
import { CrmContext } from "./crm-context.ts"

export function CrmProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CrmSnapshot>(() => {
    const data = createDemoDataset(new Date())
    warnIfDemoDrift(data)
    return data
  })
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modal, setModal] = useState<WorkspaceModal | null>(null)

  const selectedOpportunity = snapshot.opportunities.find((item) => item.id === selectedId) ?? null

  function setStatus(status: StatusFilter) {
    setFilters((current) => ({
      ...current,
      status: status !== "All" && current.status === status ? "All" : status,
    }))
  }

  function selectStage(stage: AcquisitionStage) {
    setFilters((current) => ({
      ...current,
      stage: current.stage === stage ? null : stage,
    }))
  }

  function toggleAttention() {
    setFilters((current) => ({ ...current, attentionOnly: !current.attentionOnly }))
  }

  function setSearch(search: string) {
    setFilters((current) => ({ ...current, search }))
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  function addOpportunity(input: NewOpportunityInput) {
    const today = new Date(snapshot.asOf)
    const opportunity = createOpportunityRecord(input, today)
    setSnapshot((current) => ({
      ...current,
      opportunities: [opportunity, ...current.opportunities],
    }))
    setFilters({ ...DEFAULT_FILTERS, search: opportunity.projectName })
    setSelectedId(opportunity.id)
    setModal(null)
  }

  function addTask(input: NewTaskInput) {
    const task = createTaskRecord(input)
    setSnapshot((current) => ({ ...current, tasks: [task, ...current.tasks] }))
    setModal(null)
  }

  function addActivity(input: NewActivityInput) {
    const activity = createActivityRecord(input, new Date())
    setSnapshot((current) => ({
      ...current,
      activities: [activity, ...current.activities],
    }))
    setModal(null)
  }

  return (
    <CrmContext.Provider
      value={{
        snapshot,
        filters,
        hasActiveFilters: hasActiveFilters(filters),
        selectedOpportunity,
        modal,
        setStatus,
        selectStage,
        toggleAttention,
        setSearch,
        clearFilters,
        openOpportunity: setSelectedId,
        closeOpportunity: () => setSelectedId(null),
        openModal: setModal,
        closeModal: () => setModal(null),
        addOpportunity,
        addTask,
        addActivity,
      }}
    >
      {children}
    </CrmContext.Provider>
  )
}
