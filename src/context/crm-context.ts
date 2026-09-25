import { createContext } from "react"
import type {
  AcquisitionStage,
  CrmSnapshot,
  DashboardFilters,
  NewActivityInput,
  NewOpportunityInput,
  NewTaskInput,
  Opportunity,
  StatusFilter,
  WorkspaceModal,
} from "../types/crm.ts"

export interface CrmContextValue {
  snapshot: CrmSnapshot
  filters: DashboardFilters
  hasActiveFilters: boolean
  selectedOpportunity: Opportunity | null
  modal: WorkspaceModal | null
  setStatus: (status: StatusFilter) => void
  selectStage: (stage: AcquisitionStage) => void
  toggleAttention: () => void
  setSearch: (search: string) => void
  clearFilters: () => void
  openOpportunity: (id: string) => void
  closeOpportunity: () => void
  openModal: (modal: WorkspaceModal) => void
  closeModal: () => void
  addOpportunity: (input: NewOpportunityInput) => void
  addTask: (input: NewTaskInput) => void
  addActivity: (input: NewActivityInput) => void
}

export const CrmContext = createContext<CrmContextValue | null>(null)
