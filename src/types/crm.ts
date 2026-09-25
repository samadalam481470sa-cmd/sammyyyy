export type OpportunityStatus = 
  | 'Active'
  | 'Pending'
  | 'Inactive'
  | 'Closed'
  | 'Declined'
  | 'Withdrew'
  | 'Completed'

export type OpportunityStage =
  | 'Target Identified'
  | 'Initial Outreach'
  | 'Preliminary Discussion'
  | 'NDA'
  | 'Initial Review'
  | 'IOI / LOI'
  | 'Exclusivity'
  | 'Due Diligence'
  | 'Closing'

export type OpportunityType =
  | 'Platform Acquisition'
  | 'Add-on Acquisition'
  | 'Organic Growth Initiative'
  | 'Carrier Capacity'

export type SourceType =
  | 'Investment Banker'
  | 'Intermediary'
  | 'Direct MGA Relationship'
  | 'Carrier Partner'
  | 'Other'

export type PriorityLevel = 'A' | 'B' | 'C'

export interface AttentionReason {
  type: 'overdue_action' | 'no_next_action' | 'stalled_activity' | 'upcoming_deadline' | 'no_owner'
  label: string
  description: string
  severity: 'high' | 'medium' | 'low'
  daysCount?: number
}

export interface Opportunity {
  id: string
  projectName: string
  entityName: string
  type: OpportunityType
  status: OpportunityStatus
  stage: OpportunityStage
  dealLead: string
  sourceType: SourceType
  sourceName: string
  specialty: string
  geography: string
  nwp: number // Net Written Premium in USD
  netRevenue: number // Net Revenue in USD
  pfEbitda: number // Pro Forma EBITDA in USD
  nextAction: string
  nextActionDate: string // YYYY-MM-DD
  priority: PriorityLevel
  lastActivityDate: string // YYYY-MM-DD
  needsAttention: boolean
  attentionReasons?: AttentionReason[]
  notes?: string
  foundedYear?: number
  employeeCount?: number
  carrierPartners?: string[]
}

export interface PriorityTask {
  id: string
  priority: PriorityLevel
  priorityLabel: string // "Must move this week", "Important but can wait", "Monitor only"
  action: string
  project: string
  projectId: string
  owner: string
  dueDate: string
  daysLeft: number
  isOverdue?: boolean
}

export interface AttentionAlert {
  id: string
  type: 'overdue_action' | 'no_next_action' | 'stalled_activity' | 'upcoming_deadline' | 'no_owner'
  title: string
  description: string
  projectName: string
  projectId: string
  dealLead: string
  daysCount?: number
  severity: 'high' | 'medium' | 'low'
  actionNeeded: string
}

export interface ActivityItem {
  id: string
  user: string
  avatar?: string
  actionText: string
  projectName: string
  projectId: string
  timestamp: string // Human readable e.g., "2 hours ago"
  type: 'stage_change' | 'note' | 'document' | 'status_change' | 'loi_update' | 'meeting'
}

export interface KPISummary {
  activeDealsCount: number
  pendingDealsCount: number
  activeNwpTotal: number
  activePfEbitdaTotal: number
  needsAttentionCount: number
}
