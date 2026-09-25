export const STATUSES = ['All Deals', 'Active', 'Pending', 'Inactive', 'Closed', 'Declined', 'Withdrew', 'Completed'] as const
export type Status = Exclude<(typeof STATUSES)[number], 'All Deals'>

export const ACQUISITION_STAGES = [
  'Target Identified', 'Initial Outreach', 'Preliminary Discussion', 'NDA',
  'Initial Review', 'IOI / LOI', 'Exclusivity', 'Due Diligence', 'Closing',
] as const
export type Stage = (typeof ACQUISITION_STAGES)[number]

export interface Opportunity {
  id: string
  projectName: string
  entityName: string
  type: 'Platform Acquisition' | 'Add-on Acquisition' | 'Organic Growth Initiative' | 'Carrier Capacity'
  status: Status
  stage: Stage
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
  priority: 'A' | 'B' | 'C'
  lastActivityDate: string
  needsAttention: boolean
  attentionReason?: string
}

export const opportunities: Opportunity[] = [
  { id: 'guardian', projectName: 'Project Guardian', entityName: 'CrossCover Insurance Services', type: 'Platform Acquisition', status: 'Active', stage: 'NDA', dealLead: 'Dennis DiCapua', sourceType: 'Investment Banker', sourceName: 'Harbor Ridge', specialty: 'Specialty P&C', geography: 'Northeast', nwp: 42.8, netRevenue: 7.1, pfEbitda: 4.8, nextAction: 'Review initial materials', nextActionDate: 'Sep 28', priority: 'A', lastActivityDate: '2 hours ago', needsAttention: false },
  { id: 'jugular', projectName: 'Project Jugular', entityName: 'Orion Intermediaries', type: 'Platform Acquisition', status: 'Active', stage: 'Initial Review', dealLead: 'Mary Sbaschnig', sourceType: 'Intermediary', sourceName: 'Northstar Partners', specialty: 'Professional Liability', geography: 'Midwest', nwp: 31.6, netRevenue: 5.2, pfEbitda: 3.5, nextAction: 'Schedule follow-up', nextActionDate: 'Sep 29', priority: 'A', lastActivityDate: 'Yesterday', needsAttention: false },
  { id: 'beacon', projectName: 'Project Beacon', entityName: 'Mariner Specialty Underwriters', type: 'Add-on Acquisition', status: 'Active', stage: 'Due Diligence', dealLead: 'Mary Sbaschnig', sourceType: 'Direct MGA Relationship', sourceName: 'Management referral', specialty: 'Marine', geography: 'Southeast', nwp: 27.4, netRevenue: 4.3, pfEbitda: 2.6, nextAction: 'Resolve diligence request list', nextActionDate: 'Sep 24', priority: 'A', lastActivityDate: '5 hours ago', needsAttention: true, attentionReason: 'Next action overdue' },
  { id: 'summit', projectName: 'Project Summit', entityName: 'Summit Risk Programs', type: 'Platform Acquisition', status: 'Pending', stage: 'Preliminary Discussion', dealLead: 'Dennis DiCapua', sourceType: 'Investment Banker', sourceName: 'Bexley Capital', specialty: 'Commercial Auto', geography: 'West', nwp: 38.2, netRevenue: 6.8, pfEbitda: 4.1, nextAction: 'Await management availability', nextActionDate: 'Oct 2', priority: 'B', lastActivityDate: 'Yesterday', needsAttention: false },
  { id: 'atlas', projectName: 'Project Atlas', entityName: 'Atlas Program Managers', type: 'Add-on Acquisition', status: 'Active', stage: 'IOI / LOI', dealLead: 'Dennis DiCapua', sourceType: 'Intermediary', sourceName: 'Granite Advisors', specialty: 'Property', geography: 'National', nwp: 24.1, netRevenue: 3.6, pfEbitda: 2.2, nextAction: 'Circulate revised LOI', nextActionDate: 'Sep 27', priority: 'A', lastActivityDate: '2 days ago', needsAttention: true, attentionReason: 'Critical deadline within 7 days' },
  { id: 'harbor', projectName: 'Project Harbor', entityName: 'Harbor Point Risk Solutions', type: 'Platform Acquisition', status: 'Active', stage: 'Initial Outreach', dealLead: 'Emily Park', sourceType: 'Carrier Partner', sourceName: 'Coastal Mutual', specialty: 'Excess & Surplus', geography: 'Mid-Atlantic', nwp: 19.7, netRevenue: 3.1, pfEbitda: 1.9, nextAction: null, nextActionDate: null, priority: 'B', lastActivityDate: '12 days ago', needsAttention: true, attentionReason: 'No next action assigned' },
  { id: 'crest', projectName: 'Project Crest', entityName: 'Crestline Underwriting', type: 'Carrier Capacity', status: 'Inactive', stage: 'Target Identified', dealLead: 'Emily Park', sourceType: 'Other', sourceName: 'Industry research', specialty: 'Workers Compensation', geography: 'Southwest', nwp: 14.2, netRevenue: 2.4, pfEbitda: 1.5, nextAction: 'Monitor leadership change', nextActionDate: 'Oct 16', priority: 'C', lastActivityDate: '31 days ago', needsAttention: false },
  { id: 'meridian', projectName: 'Project Meridian', entityName: 'Meridian Wholesale Partners', type: 'Platform Acquisition', status: 'Closed', stage: 'Closing', dealLead: 'Dennis DiCapua', sourceType: 'Investment Banker', sourceName: 'Apex Advisory', specialty: 'Wholesale', geography: 'National', nwp: 54.3, netRevenue: 8.4, pfEbitda: 5.8, nextAction: 'Archive closing documentation', nextActionDate: 'Oct 4', priority: 'B', lastActivityDate: '3 days ago', needsAttention: false },
]

export const formatMoney = (value: number) => `$${value.toFixed(1)}M`
