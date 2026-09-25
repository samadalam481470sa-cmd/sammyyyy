export const OPPORTUNITY_STATUSES = [
  "Active",
  "Pending",
  "Inactive",
  "Closed",
  "Declined",
  "Withdrew",
  "Completed",
] as const

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number]

export const ACQUISITION_STAGES = [
  "Target Identified",
  "Initial Outreach",
  "Preliminary Discussion",
  "NDA",
  "Initial Review",
  "IOI / LOI",
  "Exclusivity",
  "Due Diligence",
  "Closing",
] as const

export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number]

export const OPPORTUNITY_TYPES = [
  "Platform Acquisition",
  "Add-on Acquisition",
  "Organic Growth Initiative",
  "Carrier Capacity",
] as const

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]

export const SOURCE_TYPES = [
  "Investment Banker",
  "Intermediary",
  "Direct MGA Relationship",
  "Carrier Partner",
  "Other",
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const PRIORITIES = ["A", "B", "C"] as const

export type Priority = (typeof PRIORITIES)[number]

export const ATTENTION_REASONS = [
  "No deal owner assigned",
  "No next action assigned",
  "Next action overdue",
  "Upcoming deadline within 7 days",
  "No activity in 30+ days",
] as const

export type AttentionReason = (typeof ATTENTION_REASONS)[number]

export const ACTIVITY_KINDS = ["stage", "note", "document", "status", "terms"] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export type StatusFilter = "All" | OpportunityStatus

export interface DashboardFilters {
  status: StatusFilter
  stage: AcquisitionStage | null
  attentionOnly: boolean
  search: string
}

export type WorkspaceModal = "opportunity" | "task" | "activity" | "import"

export interface Opportunity {
  id: string
  projectName: string
  entityName: string
  type: OpportunityType
  status: OpportunityStatus
  stage: AcquisitionStage
  dealLead: string | null
  sourceType: SourceType
  sourceName: string
  specialty: string
  geography: string
  nwp: number
  netRevenue: number
  pfEbitda: number
  nextAction: string | null
  nextActionDate: string | null
  priority: Priority | null
  lastActivityDate: string
  criticalDeadline: string | null
  needsAttention: boolean
  attentionReason: AttentionReason | null
}

export interface PriorityTask {
  id: string
  priority: Priority
  action: string
  projectId: string
  owner: string
  dueDate: string
}

export interface ActivityItem {
  id: string
  projectId: string
  message: string
  occurredAt: string
  kind: ActivityKind
}

export interface CrmSnapshot {
  asOf: string
  opportunities: Opportunity[]
  tasks: PriorityTask[]
  activities: ActivityItem[]
}

export interface NewOpportunityInput {
  projectName: string
  entityName: string
  type: OpportunityType
  status: OpportunityStatus
  stage: AcquisitionStage
  priority: Priority
  dealLead: string
  nwpMillions: number
  netRevenueMillions: number
  pfEbitdaMillions: number
  nextAction: string
  nextActionDate: string
}

export interface NewTaskInput {
  priority: Priority
  action: string
  projectId: string
  owner: string
  dueDate: string
}

export interface NewActivityInput {
  projectId: string
  message: string
  kind: ActivityKind
}
