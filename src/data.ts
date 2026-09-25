export const DEAL_STATUSES = ['Active', 'Pending', 'Inactive', 'Closed', 'Declined', 'Withdrew', 'Completed'] as const
export const DEAL_STAGES = [
  'Target Identified',
  'Initial Outreach',
  'Preliminary Discussion',
  'NDA',
  'Initial Review',
  'IOI / LOI',
  'Exclusivity',
  'Due Diligence',
  'Closing',
] as const

export type DealStatus = (typeof DEAL_STATUSES)[number]
export type DealStage = (typeof DEAL_STAGES)[number]
export type Priority = 'A' | 'B' | 'C'

export interface Opportunity {
  id: string
  projectName: string
  entityName: string
  type: 'Platform Acquisition' | 'Add-on Acquisition' | 'Organic Growth Initiative' | 'Carrier Capacity'
  status: DealStatus
  stage: DealStage
  dealLead: string
  sourceType: 'Investment Banker' | 'Intermediary' | 'Direct MGA Relationship' | 'Carrier Partner' | 'Other'
  sourceName: string
  specialty: string
  geography: string
  nwp: number
  netRevenue: number
  pfEbitda: number
  nextAction: string | null
  nextActionDate: string | null
  priority: Priority
  lastActivityDate: string
  needsAttention: boolean
  attentionReason?: string
}

export const opportunities: Opportunity[] = [
  {
    id: 'guardian', projectName: 'Project Guardian', entityName: 'CrossCover Insurance Services',
    type: 'Platform Acquisition', status: 'Active', stage: 'NDA', dealLead: 'Dennis DiCapua',
    sourceType: 'Investment Banker', sourceName: 'Northbridge Partners', specialty: 'Professional Lines',
    geography: 'Northeast', nwp: 42_000_000, netRevenue: 14_800_000, pfEbitda: 6_200_000,
    nextAction: 'Review initial materials', nextActionDate: '2026-09-26', priority: 'A',
    lastActivityDate: '2026-09-25', needsAttention: true, attentionReason: 'Upcoming deadline within 7 days',
  },
  {
    id: 'jugular', projectName: 'Project Jugular', entityName: 'Orion Intermediaries',
    type: 'Add-on Acquisition', status: 'Active', stage: 'Initial Review', dealLead: 'Mary Sbaschnig',
    sourceType: 'Direct MGA Relationship', sourceName: 'Management referral', specialty: 'Casualty',
    geography: 'Southeast', nwp: 31_000_000, netRevenue: 10_200_000, pfEbitda: 4_500_000,
    nextAction: 'Schedule follow-up', nextActionDate: '2026-09-27', priority: 'A',
    lastActivityDate: '2026-09-24', needsAttention: false,
  },
  {
    id: 'beacon', projectName: 'Project Beacon', entityName: 'Beacon Risk Underwriters',
    type: 'Platform Acquisition', status: 'Active', stage: 'Due Diligence', dealLead: 'Mary Sbaschnig',
    sourceType: 'Investment Banker', sourceName: 'Harborview Capital', specialty: 'Marine',
    geography: 'National', nwp: 54_000_000, netRevenue: 17_100_000, pfEbitda: 7_300_000,
    nextAction: 'Complete quality of earnings review', nextActionDate: '2026-09-29', priority: 'A',
    lastActivityDate: '2026-09-25', needsAttention: false,
  },
  {
    id: 'summit', projectName: 'Project Summit', entityName: 'Summit Specialty Programs',
    type: 'Platform Acquisition', status: 'Active', stage: 'Preliminary Discussion', dealLead: 'Dennis DiCapua',
    sourceType: 'Intermediary', sourceName: 'Sterling Advisory', specialty: 'Property',
    geography: 'West', nwp: 22_000_000, netRevenue: 7_600_000, pfEbitda: 2_900_000,
    nextAction: null, nextActionDate: null, priority: 'B',
    lastActivityDate: '2026-09-22', needsAttention: true, attentionReason: 'No next action assigned',
  },
  {
    id: 'atlas', projectName: 'Project Atlas', entityName: 'Atlas Program Administrators',
    type: 'Add-on Acquisition', status: 'Active', stage: 'IOI / LOI', dealLead: 'Evan Brooks',
    sourceType: 'Investment Banker', sourceName: 'Crestline Partners', specialty: 'Transportation',
    geography: 'Midwest', nwp: 35_000_000, netRevenue: 11_300_000, pfEbitda: 5_500_000,
    nextAction: 'Confirm revised LOI terms', nextActionDate: '2026-09-24', priority: 'A',
    lastActivityDate: '2026-09-23', needsAttention: true, attentionReason: 'Next action overdue',
  },
  {
    id: 'harbor', projectName: 'Project Harbor', entityName: 'Harborline Specialty',
    type: 'Organic Growth Initiative', status: 'Active', stage: 'Target Identified', dealLead: 'Rachel Kim',
    sourceType: 'Carrier Partner', sourceName: 'Carrier introduction', specialty: 'Environmental',
    geography: 'National', nwp: 18_000_000, netRevenue: 5_900_000, pfEbitda: 2_100_000,
    nextAction: 'Validate strategic fit', nextActionDate: '2026-10-02', priority: 'B',
    lastActivityDate: '2026-09-20', needsAttention: false,
  },
  {
    id: 'northstar', projectName: 'Project Northstar', entityName: 'Northstar Accident & Health',
    type: 'Platform Acquisition', status: 'Active', stage: 'Exclusivity', dealLead: 'Mary Sbaschnig',
    sourceType: 'Direct MGA Relationship', sourceName: 'CEO outreach', specialty: 'Accident & Health',
    geography: 'National', nwp: 29_000_000, netRevenue: 9_400_000, pfEbitda: 4_000_000,
    nextAction: 'Finalize exclusivity agreement', nextActionDate: '2026-10-01', priority: 'A',
    lastActivityDate: '2026-09-24', needsAttention: false,
  },
  {
    id: 'meridian', projectName: 'Project Meridian', entityName: 'Meridian Wholesale Group',
    type: 'Add-on Acquisition', status: 'Active', stage: 'Initial Outreach', dealLead: 'Rachel Kim',
    sourceType: 'Intermediary', sourceName: 'Industry relationship', specialty: 'Wholesale Brokerage',
    geography: 'Southwest', nwp: 14_000_000, netRevenue: 4_100_000, pfEbitda: 1_800_000,
    nextAction: 'Arrange management introduction', nextActionDate: '2026-10-05', priority: 'C',
    lastActivityDate: '2026-09-18', needsAttention: false,
  },
  {
    id: 'cobalt', projectName: 'Project Cobalt', entityName: 'Cobalt Specialty Risk',
    type: 'Platform Acquisition', status: 'Pending', stage: 'Initial Review', dealLead: 'Evan Brooks',
    sourceType: 'Investment Banker', sourceName: 'Barton & Co.', specialty: 'Cyber',
    geography: 'National', nwp: 27_000_000, netRevenue: 8_900_000, pfEbitda: 3_700_000,
    nextAction: 'Await seller response', nextActionDate: '2026-10-07', priority: 'B',
    lastActivityDate: '2026-09-17', needsAttention: false,
  },
  {
    id: 'oak', projectName: 'Project Oak', entityName: 'Oak Ridge Underwriting',
    type: 'Carrier Capacity', status: 'Pending', stage: 'Preliminary Discussion', dealLead: 'Dennis DiCapua',
    sourceType: 'Carrier Partner', sourceName: 'Carrier relationship', specialty: 'Construction',
    geography: 'Southeast', nwp: 16_000_000, netRevenue: 5_300_000, pfEbitda: 2_000_000,
    nextAction: 'Receive updated forecast', nextActionDate: '2026-10-03', priority: 'B',
    lastActivityDate: '2026-09-19', needsAttention: false,
  },
  {
    id: 'sequoia', projectName: 'Project Sequoia', entityName: 'Sequoia Program Management',
    type: 'Platform Acquisition', status: 'Pending', stage: 'NDA', dealLead: 'Rachel Kim',
    sourceType: 'Investment Banker', sourceName: 'Mason Street', specialty: 'Habitational',
    geography: 'West', nwp: 24_000_000, netRevenue: 7_200_000, pfEbitda: 3_100_000,
    nextAction: 'Confirm NDA comments', nextActionDate: '2026-10-04', priority: 'B',
    lastActivityDate: '2026-09-21', needsAttention: false,
  },
  {
    id: 'voyager', projectName: 'Project Voyager', entityName: 'Voyager Benefits Solutions',
    type: 'Add-on Acquisition', status: 'Pending', stage: 'Target Identified', dealLead: 'Mary Sbaschnig',
    sourceType: 'Other', sourceName: 'Conference', specialty: 'Employee Benefits',
    geography: 'Midwest', nwp: 11_000_000, netRevenue: 3_700_000, pfEbitda: 1_400_000,
    nextAction: 'Internal prioritization review', nextActionDate: '2026-10-09', priority: 'C',
    lastActivityDate: '2026-09-16', needsAttention: false,
  },
  {
    id: 'legacy', projectName: 'Project Legacy', entityName: 'Legacy Risk Partners',
    type: 'Platform Acquisition', status: 'Inactive', stage: 'Initial Review', dealLead: 'Evan Brooks',
    sourceType: 'Intermediary', sourceName: 'Prior relationship', specialty: 'Multi-line',
    geography: 'National', nwp: 20_000_000, netRevenue: 6_300_000, pfEbitda: 2_500_000,
    nextAction: 'Monitor for renewed interest', nextActionDate: null, priority: 'C',
    lastActivityDate: '2026-08-11', needsAttention: false,
  },
  {
    id: 'ember', projectName: 'Project Ember', entityName: 'Ember Specialty Services',
    type: 'Add-on Acquisition', status: 'Declined', stage: 'Initial Review', dealLead: 'Rachel Kim',
    sourceType: 'Investment Banker', sourceName: 'Alder Partners', specialty: 'Energy',
    geography: 'Southwest', nwp: 13_000_000, netRevenue: 3_900_000, pfEbitda: 1_300_000,
    nextAction: null, nextActionDate: null, priority: 'C',
    lastActivityDate: '2026-08-29', needsAttention: false,
  },
  {
    id: 'granite', projectName: 'Project Granite', entityName: 'Granite Insurance Managers',
    type: 'Platform Acquisition', status: 'Completed', stage: 'Closing', dealLead: 'Dennis DiCapua',
    sourceType: 'Direct MGA Relationship', sourceName: 'Founder relationship', specialty: 'Public Entity',
    geography: 'Northeast', nwp: 38_000_000, netRevenue: 12_100_000, pfEbitda: 5_000_000,
    nextAction: null, nextActionDate: null, priority: 'C',
    lastActivityDate: '2026-09-12', needsAttention: false,
  },
  {
    id: 'lighthouse', projectName: 'Project Lighthouse', entityName: 'Lighthouse Marine Underwriters',
    type: 'Add-on Acquisition', status: 'Closed', stage: 'Closing', dealLead: 'Mary Sbaschnig',
    sourceType: 'Investment Banker', sourceName: 'Barton & Co.', specialty: 'Marine',
    geography: 'Southeast', nwp: 19_000_000, netRevenue: 5_800_000, pfEbitda: 2_200_000,
    nextAction: null, nextActionDate: null, priority: 'C',
    lastActivityDate: '2026-07-30', needsAttention: false,
  },
]

export const weeklyPriorities = [
  { priority: 'A', action: 'Review initial materials', project: 'Project Guardian', owner: 'Dennis', due: 'Today' },
  { priority: 'A', action: 'Confirm revised LOI terms', project: 'Project Atlas', owner: 'Evan', due: 'Overdue' },
  { priority: 'A', action: 'Complete QofE review', project: 'Project Beacon', owner: 'Mary', due: 'Mon, Sep 29' },
  { priority: 'B', action: 'Validate strategic fit', project: 'Project Harbor', owner: 'Rachel', due: 'Thu, Oct 2' },
]

export const recentActivity = [
  { type: 'stage', text: 'Dennis moved Project Guardian to NDA', time: '2 hours ago' },
  { type: 'note', text: 'Mary added a note to Project Beacon', time: '5 hours ago' },
  { type: 'file', text: 'Initial materials uploaded for Project Jugular', time: 'Yesterday' },
  { type: 'status', text: 'Project Summit moved from Pending to Active', time: 'Yesterday' },
  { type: 'file', text: 'LOI updated for Project Atlas', time: '2 days ago' },
]
