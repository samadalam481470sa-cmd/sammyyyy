/**
 * Centralized pick-list configuration.
 *
 * STATUS and STAGE are deliberately separate concepts:
 *  - Status = the broad condition of an opportunity (Active, Pending, ...).
 *  - Stage  = where an *active* deal sits in the acquisition process (NDA, LOI, ...).
 *
 * Stage names are preliminary and may change after sponsor feedback, so they are
 * defined once here and referenced by id everywhere else. These lists are the
 * single source of truth for dropdown/pick-list values and can later be served
 * from a database/API without touching component code.
 */

export interface PicklistOption<Id extends string = string> {
  id: Id
  label: string
}

export const STATUSES = [
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'closed', label: 'Closed' },
  { id: 'declined', label: 'Declined' },
  { id: 'withdrew', label: 'Withdrew' },
  { id: 'completed', label: 'Completed' },
] as const satisfies readonly PicklistOption[]

export type StatusId = (typeof STATUSES)[number]['id']

/** Ordered by progression through the acquisition process. */
export const STAGES = [
  { id: 'target-identified', label: 'Target Identified' },
  { id: 'initial-outreach', label: 'Initial Outreach' },
  { id: 'preliminary-discussion', label: 'Preliminary Discussion' },
  { id: 'nda', label: 'NDA' },
  { id: 'initial-review', label: 'Initial Review' },
  { id: 'ioi-loi', label: 'IOI / LOI' },
  { id: 'exclusivity', label: 'Exclusivity' },
  { id: 'due-diligence', label: 'Due Diligence' },
  { id: 'closing', label: 'Closing' },
] as const satisfies readonly PicklistOption[]

export type StageId = (typeof STAGES)[number]['id']

export const OPPORTUNITY_TYPES = [
  { id: 'platform', label: 'Platform Acquisition' },
  { id: 'add-on', label: 'Add-on Acquisition' },
  { id: 'organic-growth', label: 'Organic Growth Initiative' },
  { id: 'carrier-capacity', label: 'Carrier Capacity' },
] as const satisfies readonly PicklistOption[]

export type OpportunityTypeId = (typeof OPPORTUNITY_TYPES)[number]['id']

export const SOURCE_TYPES = [
  { id: 'investment-banker', label: 'Investment Banker' },
  { id: 'intermediary', label: 'Intermediary' },
  { id: 'direct-mga', label: 'Direct MGA Relationship' },
  { id: 'carrier-partner', label: 'Carrier Partner' },
  { id: 'other', label: 'Other' },
] as const satisfies readonly PicklistOption[]

export type SourceTypeId = (typeof SOURCE_TYPES)[number]['id']

/** Newport task priority scheme: A = must move this week, B = important, C = monitor. */
export const TASK_PRIORITIES = [
  { id: 'A', label: 'Must move this week' },
  { id: 'B', label: 'Important but can wait' },
  { id: 'C', label: 'Monitor only' },
] as const satisfies readonly PicklistOption[]

export type TaskPriorityId = (typeof TASK_PRIORITIES)[number]['id']

const byId = <T extends PicklistOption>(list: readonly T[]) =>
  new Map(list.map((o) => [o.id, o]))

const statusById = byId(STATUSES)
const stageById = byId(STAGES)
const typeById = byId(OPPORTUNITY_TYPES)
const sourceTypeById = byId(SOURCE_TYPES)

export const statusLabel = (id: StatusId) => statusById.get(id)?.label ?? id
export const stageLabel = (id: StageId) => stageById.get(id)?.label ?? id
export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id)
export const opportunityTypeLabel = (id: OpportunityTypeId) => typeById.get(id)?.label ?? id
export const sourceTypeLabel = (id: SourceTypeId) => sourceTypeById.get(id)?.label ?? id
