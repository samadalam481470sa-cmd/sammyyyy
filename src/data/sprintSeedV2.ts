/**
 * Starter data added in the October 30, 2026 sprint (dataset version "oct30-2026").
 * Every name, entity, contact and figure here is fictional sample data. Nothing is copied from
 * sponsor records. These rows are added once per browser on top of the existing 42 deals and are
 * never re-added after a user edits or deletes them (see lib/seedLedger.ts).
 */
import type { Opportunity, OpportunityStatus, AcquisitionStage, StatusChange } from '@/types'
import type { ContactRecord, TaskRecord } from './mockModules'

export const SEED_V2_VERSION = 'oct30-2026'

type V2Deal = {
  code: string
  status: OpportunityStatus
  stage: AcquisitionStage
  lead: 'Mary Sbaschnig' | 'Dennis DiCapua'
  type: Opportunity['type']
  sourceType: Opportunity['sourceType']
  specialty: string
  geography: string
  nwp: number
  pfEbitda: number
  created: string
  /** Extra recorded status steps after creation, oldest first. */
  steps?: { to: OpportunityStatus; at: string }[]
}

const DEALS: V2Deal[] = [
  { code: 'AQ', status: 'Active', stage: 'Due Diligence', lead: 'Mary Sbaschnig', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Excess Casualty', geography: 'Southeast US', nwp: 22_500_000, pfEbitda: 2_100_000, created: '2026-06-03T15:00:00Z', steps: [{ to: 'Active', at: '2026-07-14T16:00:00Z' }] },
  { code: 'AR', status: 'Active', stage: 'IOI / LOI', lead: 'Dennis DiCapua', type: 'Add-on Acquisition', sourceType: 'Intermediary', specialty: 'Inland Marine', geography: 'Midwest', nwp: 8_400_000, pfEbitda: 760_000, created: '2026-07-08T14:30:00Z', steps: [{ to: 'Active', at: '2026-08-19T15:00:00Z' }] },
  { code: 'AS', status: 'Active', stage: 'Initial Review', lead: 'Mary Sbaschnig', type: 'Platform Acquisition', sourceType: 'Direct MGA Relationship', specialty: 'Habitational Property', geography: 'Gulf Coast', nwp: 14_200_000, pfEbitda: 1_350_000, created: '2026-08-12T13:00:00Z', steps: [{ to: 'Active', at: '2026-09-02T17:00:00Z' }] },
  { code: 'AT', status: 'Active', stage: 'NDA', lead: 'Dennis DiCapua', type: 'Add-on Acquisition', sourceType: 'Carrier Partner', specialty: 'Contractors General Liability', geography: 'Texas', nwp: 6_100_000, pfEbitda: 540_000, created: '2026-09-15T16:00:00Z', steps: [{ to: 'Active', at: '2026-10-01T14:00:00Z' }] },
  { code: 'AU', status: 'Active', stage: 'Exclusivity', lead: 'Mary Sbaschnig', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Professional Liability', geography: 'Northeast US', nwp: 31_000_000, pfEbitda: 3_050_000, created: '2026-05-20T15:00:00Z', steps: [{ to: 'Active', at: '2026-06-10T15:00:00Z' }] },
  { code: 'AV', status: 'Active', stage: 'Preliminary Discussion', lead: 'Dennis DiCapua', type: 'Organic Growth Initiative', sourceType: 'Other', specialty: 'Cyber', geography: 'National', nwp: 4_800_000, pfEbitda: 390_000, created: '2026-10-06T15:00:00Z', steps: [{ to: 'Active', at: '2026-10-20T15:00:00Z' }] },
  { code: 'AW', status: 'Pending', stage: 'Initial Outreach', lead: 'Mary Sbaschnig', type: 'Add-on Acquisition', sourceType: 'Intermediary', specialty: 'Transportation', geography: 'Mountain West', nwp: 9_700_000, pfEbitda: 880_000, created: '2026-09-29T15:00:00Z' },
  { code: 'AX', status: 'Pending', stage: 'Target Identified', lead: 'Dennis DiCapua', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Environmental Liability', geography: 'Pacific Northwest', nwp: 12_800_000, pfEbitda: 1_150_000, created: '2026-10-13T15:00:00Z' },
  { code: 'AY', status: 'Pending', stage: 'Preliminary Discussion', lead: 'Mary Sbaschnig', type: 'Carrier Capacity', sourceType: 'Carrier Partner', specialty: 'Commercial Property', geography: 'California', nwp: 17_300_000, pfEbitda: 1_600_000, created: '2026-08-26T15:00:00Z' },
  { code: 'AZ', status: 'Pending', stage: 'NDA', lead: 'Dennis DiCapua', type: 'Add-on Acquisition', sourceType: 'Direct MGA Relationship', specialty: 'Workers Compensation', geography: 'Mid-Atlantic', nwp: 7_250_000, pfEbitda: 615_000, created: '2026-10-22T15:00:00Z' },
  { code: 'BA', status: 'Completed', stage: 'Closing', lead: 'Mary Sbaschnig', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Specialty Auto', geography: 'Southeast US', nwp: 26_400_000, pfEbitda: 2_480_000, created: '2026-02-10T15:00:00Z', steps: [{ to: 'Active', at: '2026-03-04T15:00:00Z' }, { to: 'Completed', at: '2026-07-28T17:00:00Z' }] },
  { code: 'BB', status: 'Completed', stage: 'Closing', lead: 'Dennis DiCapua', type: 'Add-on Acquisition', sourceType: 'Intermediary', specialty: 'Ocean Marine', geography: 'Gulf Coast', nwp: 11_900_000, pfEbitda: 1_040_000, created: '2026-03-18T15:00:00Z', steps: [{ to: 'Active', at: '2026-04-08T15:00:00Z' }, { to: 'Completed', at: '2026-09-15T20:00:00Z' }] },
  { code: 'BC', status: 'Completed', stage: 'Closing', lead: 'Mary Sbaschnig', type: 'Add-on Acquisition', sourceType: 'Direct MGA Relationship', specialty: 'Public Entity', geography: 'Midwest', nwp: 9_300_000, pfEbitda: 845_000, created: '2026-04-22T15:00:00Z', steps: [{ to: 'Active', at: '2026-05-12T15:00:00Z' }, { to: 'Completed', at: '2026-10-16T20:00:00Z' }] },
  { code: 'BD', status: 'Inactive', stage: 'Initial Review', lead: 'Dennis DiCapua', type: 'Platform Acquisition', sourceType: 'Other', specialty: 'Aviation', geography: 'National', nwp: 15_600_000, pfEbitda: 1_420_000, created: '2026-04-01T15:00:00Z', steps: [{ to: 'Active', at: '2026-05-06T15:00:00Z' }, { to: 'Inactive', at: '2026-08-21T15:00:00Z' }] },
  { code: 'BE', status: 'Inactive', stage: 'Initial Outreach', lead: 'Mary Sbaschnig', type: 'Add-on Acquisition', sourceType: 'Intermediary', specialty: 'Crop and Farm', geography: 'Great Plains', nwp: 5_400_000, pfEbitda: 470_000, created: '2026-06-17T15:00:00Z', steps: [{ to: 'Inactive', at: '2026-09-09T15:00:00Z' }] },
  { code: 'BF', status: 'Declined', stage: 'IOI / LOI', lead: 'Dennis DiCapua', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Medical Stop Loss', geography: 'National', nwp: 19_800_000, pfEbitda: 1_870_000, created: '2026-03-30T15:00:00Z', steps: [{ to: 'Active', at: '2026-04-21T15:00:00Z' }, { to: 'Declined', at: '2026-07-07T15:00:00Z' }] },
  { code: 'BG', status: 'Declined', stage: 'Preliminary Discussion', lead: 'Mary Sbaschnig', type: 'Add-on Acquisition', sourceType: 'Carrier Partner', specialty: 'Pet Insurance', geography: 'National', nwp: 3_900_000, pfEbitda: 310_000, created: '2026-07-21T15:00:00Z', steps: [{ to: 'Declined', at: '2026-09-25T15:00:00Z' }] },
  { code: 'BH', status: 'Withdrew', stage: 'Due Diligence', lead: 'Dennis DiCapua', type: 'Platform Acquisition', sourceType: 'Investment Banker', specialty: 'Construction Wrap-Up', geography: 'Southwest', nwp: 24_100_000, pfEbitda: 2_260_000, created: '2026-01-27T15:00:00Z', steps: [{ to: 'Active', at: '2026-02-24T15:00:00Z' }, { to: 'Withdrew', at: '2026-06-18T15:00:00Z' }] },
  { code: 'BI', status: 'Withdrew', stage: 'NDA', lead: 'Mary Sbaschnig', type: 'Add-on Acquisition', sourceType: 'Direct MGA Relationship', specialty: 'Event Liability', geography: 'Northeast US', nwp: 2_700_000, pfEbitda: 205_000, created: '2026-08-05T15:00:00Z', steps: [{ to: 'Active', at: '2026-08-28T15:00:00Z' }, { to: 'Withdrew', at: '2026-10-09T15:00:00Z' }] },
  { code: 'BJ', status: 'Closed', stage: 'Exclusivity', lead: 'Dennis DiCapua', type: 'Carrier Capacity', sourceType: 'Carrier Partner', specialty: 'Earthquake', geography: 'California', nwp: 13_400_000, pfEbitda: 1_210_000, created: '2026-02-16T15:00:00Z', steps: [{ to: 'Active', at: '2026-03-11T15:00:00Z' }, { to: 'Closed', at: '2026-08-04T15:00:00Z' }] },
]

const LEAD_ID: Record<V2Deal['lead'], string> = {
  'Mary Sbaschnig': 'user-mary',
  'Dennis DiCapua': 'user-dennis',
}

export function v2OpportunityId(code: string): string {
  return `opp-${code.toLowerCase()}`
}

function history(deal: V2Deal): StatusChange[] {
  const firstStatus: OpportunityStatus = deal.steps?.length ? 'Pending' : deal.status
  const rows: StatusChange[] = [{ from: null, to: firstStatus, at: deal.created }]
  let previous = firstStatus
  for (const step of deal.steps ?? []) {
    if (step.to === previous) continue
    rows.push({ from: previous, to: step.to, at: step.at })
    previous = step.to
  }
  return rows
}

export const seedV2Opportunities: Opportunity[] = DEALS.map((deal, index) => {
  const statusHistory = history(deal)
  const completed = statusHistory.find((row) => row.to === 'Completed')
  const last = statusHistory[statusHistory.length - 1]
  return {
    id: v2OpportunityId(deal.code),
    projectNumber: 43 + index,
    projectName: `Project ${deal.code}`,
    entityName: `Entity ${deal.code}`,
    type: deal.type,
    status: deal.status,
    stage: deal.stage,
    dealLead: deal.lead,
    sourceType: deal.sourceType,
    sourceName: deal.sourceType === 'Investment Banker' ? 'Fictional Capital Advisors' : deal.sourceType === 'Intermediary' ? 'Sample Brokerage Partners' : deal.sourceType === 'Carrier Partner' ? 'Example Mutual Carrier' : 'Direct outreach',
    specialty: deal.specialty,
    geography: deal.geography,
    nwp: deal.nwp,
    netRevenue: Math.round(deal.nwp * 0.21),
    pfEbitda: deal.pfEbitda,
    nextAction: null,
    nextActionDate: null,
    priority: (['A', 'B', 'C'] as const)[index % 3],
    nextActionManual: null,
    nextActionDateManual: null,
    priorityManual: (['A', 'B', 'C'] as const)[index % 3],
    nextActionTaskId: null,
    lastActivityDate: last.at,
    needsAttention: false,
    attentionReasons: [],
    outstandingItems: [],
    diligenceNotes: 'Fictional sample deal added Oct 30, 2026. Not a live Newport target.',
    createdAt: deal.created,
    completedAt: completed?.at ?? null,
    statusHistory,
  }
})

type V2Task = {
  id: string
  code: string
  action: string
  priority: 'A' | 'B' | 'C'
  due: string
  status?: 'Open' | 'In Progress' | 'Done'
  created: string
  completedAt?: string
  /** Assigned owner when different from the deal lead. */
  owner?: V2Deal['lead']
  /** Original due date when it was moved once. */
  movedFrom?: { due: string; at: string }
}

const TASKS: V2Task[] = [
  // Overdue: early, mid and late October 2026.
  { id: 'task-v2-01', code: 'AQ', action: 'Collect loss-run detail for fictional diligence file', priority: 'A', due: '2026-10-05', created: '2026-09-21T15:00:00Z' },
  { id: 'task-v2-02', code: 'AR', action: 'Return marked-up sample LOI to banker', priority: 'A', due: '2026-10-14', created: '2026-10-01T15:00:00Z', status: 'In Progress' },
  { id: 'task-v2-03', code: 'AW', action: 'Send intro email to sample intermediary', priority: 'B', due: '2026-10-22', created: '2026-10-02T15:00:00Z', owner: 'Dennis DiCapua' },
  { id: 'task-v2-04', code: 'AY', action: 'Request carrier capacity summary (fictional)', priority: 'C', due: '2026-10-28', created: '2026-10-12T15:00:00Z', movedFrom: { due: '2026-10-21', at: '2026-10-20T15:00:00Z' } },
  // Due today, October 30, 2026.
  { id: 'task-v2-05', code: 'AS', action: 'Review sample quality-of-earnings outline', priority: 'A', due: '2026-10-30', created: '2026-10-15T15:00:00Z' },
  { id: 'task-v2-06', code: 'AZ', action: 'Circulate draft NDA to counsel', priority: 'B', due: '2026-10-30', created: '2026-10-23T15:00:00Z', owner: 'Mary Sbaschnig' },
  // November 1 to 6 (inside the 7-day window).
  { id: 'task-v2-07', code: 'AU', action: 'Schedule exclusivity check-in with sample management team', priority: 'A', due: '2026-11-01', created: '2026-10-19T15:00:00Z' },
  { id: 'task-v2-08', code: 'AT', action: 'Confirm NDA signature status', priority: 'B', due: '2026-11-03', created: '2026-10-05T15:00:00Z' },
  { id: 'task-v2-09', code: 'AV', action: 'Draft cyber program overview for internal review', priority: 'C', due: '2026-11-05', created: '2026-10-21T15:00:00Z' },
  { id: 'task-v2-10', code: 'AQ', action: 'Book on-site diligence visit (fictional)', priority: 'B', due: '2026-11-06', created: '2026-10-08T15:00:00Z' },
  // Later in November and December 2026, and into 2027.
  { id: 'task-v2-11', code: 'AR', action: 'Prepare sample purchase price bridge', priority: 'B', due: '2026-11-16', created: '2026-10-17T15:00:00Z', owner: 'Mary Sbaschnig' },
  { id: 'task-v2-12', code: 'AU', action: 'Coordinate draft agreement review', priority: 'A', due: '2026-11-24', created: '2026-10-26T15:00:00Z' },
  { id: 'task-v2-13', code: 'AS', action: 'Compile fictional producer roster', priority: 'C', due: '2026-12-08', created: '2026-10-27T15:00:00Z' },
  { id: 'task-v2-14', code: 'AV', action: 'Set Q1 planning session for cyber initiative', priority: 'C', due: '2027-01-12', created: '2026-10-28T15:00:00Z' },
  { id: 'task-v2-15', code: 'AX', action: 'Revisit target screen after year-end figures', priority: 'B', due: '2027-02-09', created: '2026-10-14T15:00:00Z' },
  // Completed work (stays in the list for 7 days after completion, then moves to History).
  { id: 'task-v2-16', code: 'AT', action: 'Send fictional teaser request', priority: 'B', due: '2026-10-24', created: '2026-10-02T15:00:00Z', status: 'Done', completedAt: '2026-10-27T18:00:00Z' },
  { id: 'task-v2-17', code: 'BC', action: 'File closing checklist (sample)', priority: 'A', due: '2026-10-15', created: '2026-09-28T15:00:00Z', status: 'Done', completedAt: '2026-10-16T19:00:00Z' },
  { id: 'task-v2-18', code: 'BA', action: 'Close out integration kickoff notes', priority: 'C', due: '2026-08-14', created: '2026-07-24T15:00:00Z', status: 'Done', completedAt: '2026-08-13T15:00:00Z' },
  // Completed and inactive deals keep tasks, but never raise alerts.
  { id: 'task-v2-19', code: 'BB', action: 'Archive fictional closing binder', priority: 'C', due: '2026-10-20', created: '2026-09-16T15:00:00Z' },
  { id: 'task-v2-20', code: 'BD', action: 'Check back on paused aviation target', priority: 'C', due: '2026-12-15', created: '2026-08-21T15:00:00Z' },
]

export const seedV2Tasks: TaskRecord[] = TASKS.map((task) => {
  const deal = DEALS.find((row) => row.code === task.code)!
  const owner = task.owner ?? deal.lead
  const status = task.status ?? 'Open'
  return {
    id: task.id,
    priority: task.priority,
    action: task.action,
    opportunityId: v2OpportunityId(task.code),
    projectName: `Project ${task.code}`,
    owner,
    ownerId: LEAD_ID[owner],
    dueDate: task.due,
    initialDueDate: task.movedFrom?.due ?? task.due,
    dueDateHistory: task.movedFrom ? [{ from: task.movedFrom.due, to: task.due, at: task.movedFrom.at }] : [],
    status,
    notes: 'Fictional sample task. Not a live work item.',
    completedAt: status === 'Done' ? task.completedAt ?? null : null,
    archivedAt: null,
    deletedAt: null,
    createdAt: task.created,
    updatedAt: task.completedAt ?? task.movedFrom?.at ?? task.created,
  }
})

const FIRST = ['Casey', 'Morgan', 'Taylor', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Parker']
const LAST = ['Lindqvist', 'Okafor', 'Brennan', 'Castellano', 'Whitfield', 'Nakamura', 'Delacroix', 'Fairbanks', 'Haverford', 'Ashdown']
const ROLES: { title: string; category: string }[] = [
  { title: 'CEO', category: 'Management' },
  { title: 'President', category: 'Management' },
  { title: 'Managing Director', category: 'Investment Banker' },
  { title: 'Partner', category: 'Lawyer' },
  { title: 'Audit Partner', category: 'Accountant' },
]

/** One management contact per new deal, plus one shared advisor linked to two deals. */
export const seedV2Contacts: ContactRecord[] = [
  ...DEALS.map((deal, index) => {
    const role = ROLES[index % 2]
    const first = FIRST[index % FIRST.length]
    const last = LAST[(index * 3) % LAST.length]
    return {
      id: `rel-v2-${deal.code.toLowerCase()}`,
      name: `${first} ${last}`,
      title: role.title,
      company: `Entity ${deal.code}`,
      category: role.category,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@entity-${deal.code.toLowerCase()}.example`,
      phone: '(555) 010-0142',
      opportunityId: v2OpportunityId(deal.code),
      opportunityIds: [v2OpportunityId(deal.code)],
      projectName: `Project ${deal.code}`,
      status: ['Inactive', 'Declined', 'Withdrew', 'Closed'].includes(deal.status) ? 'Inactive' : 'Active',
      lastContactDate: deal.steps?.[deal.steps.length - 1]?.at.slice(0, 10) ?? deal.created.slice(0, 10),
      notes: 'Fictional contact. Not a live Newport relationship.',
    }
  }),
  {
    id: 'rel-v2-advisor-shared',
    name: 'Harper Vance',
    title: 'Managing Director',
    company: 'Fictional Capital Advisors',
    category: 'Investment Banker',
    email: 'harper.vance@fictional-capital.example',
    phone: '(555) 010-0199',
    opportunityId: v2OpportunityId('AQ'),
    opportunityIds: [v2OpportunityId('AQ'), v2OpportunityId('AU')],
    projectName: 'Project AQ',
    status: 'Active',
    lastContactDate: '2026-10-21',
    notes: 'Fictional banker covering two sample deals.',
  },
]

/** Every collection/id this dataset version adds. Used to tell new seed rows from older ones. */
export const SEED_V2_KEYS: ReadonlySet<string> = new Set([
  ...seedV2Opportunities.map((row) => `opportunities/${row.id}`),
  ...seedV2Tasks.map((row) => `tasks/${row.id}`),
  ...seedV2Contacts.map((row) => `contacts/${row.id}`),
])
