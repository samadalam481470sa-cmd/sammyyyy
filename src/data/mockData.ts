import { Opportunity, PriorityTask, AttentionAlert, ActivityItem } from '../types/crm'

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    projectName: 'Project Guardian',
    entityName: 'CrossCover Insurance Services',
    type: 'Platform Acquisition',
    status: 'Active',
    stage: 'NDA',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Investment Banker',
    sourceName: 'Stonemark Partners',
    specialty: 'Commercial Property & Excess E&S',
    geography: 'Houston, TX / National',
    nwp: 48500000,
    netRevenue: 8200000,
    pfEbitda: 6800000,
    nextAction: 'Review initial confidential information memorandum and actuarial pack',
    nextActionDate: '2026-09-28',
    priority: 'A',
    lastActivityDate: '2026-09-25',
    needsAttention: false,
    notes: 'Premier excess property MGA with strong loss ratios across hurricane tier-1. Clean historical loss runs over 7 years.',
    foundedYear: 2017,
    employeeCount: 42,
    carrierPartners: ['Munich Re', 'Everest', 'Lloyds Syndicate 2003']
  },
  {
    id: 'opp-2',
    projectName: 'Project Jugular',
    entityName: 'Orion Intermediaries',
    type: 'Add-on Acquisition',
    status: 'Active',
    stage: 'Initial Review',
    dealLead: 'Mary Sbaschnig',
    sourceType: 'Intermediary',
    sourceName: 'Harborstone Advisory',
    specialty: 'Specialty Casualty & Environmental Liability',
    geography: 'Philadelphia, PA',
    nwp: 36000000,
    netRevenue: 6400000,
    pfEbitda: 5200000,
    nextAction: 'Schedule follow-up management call regarding underwriting authority and capacity',
    nextActionDate: '2026-09-26',
    priority: 'A',
    lastActivityDate: '2026-09-24',
    needsAttention: true,
    attentionReasons: [
      {
        type: 'upcoming_deadline',
        label: 'Upcoming IOI Deadline',
        description: 'First round IOI indication due to banker within 4 business days.',
        severity: 'high',
        daysCount: 4
      }
    ],
    notes: 'Proprietary distribution with 180+ retail brokerage partners. Carrier capacity renewable in Q1 2027.',
    foundedYear: 2015,
    employeeCount: 28,
    carrierPartners: ['Arch Insurance', 'Markel']
  },
  {
    id: 'opp-3',
    projectName: 'Project Beacon',
    entityName: 'Vanguard Specialty Underwriters',
    type: 'Platform Acquisition',
    status: 'Active',
    stage: 'Due Diligence',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Direct MGA Relationship',
    sourceName: 'Founder Direct Outreach',
    specialty: 'Inland Marine & Heavy Equipment',
    geography: 'Atlanta, GA / Southeast',
    nwp: 42000000,
    netRevenue: 7100000,
    pfEbitda: 6100000,
    nextAction: 'Quality of Earnings review with Alvarez & Marsal and carrier re-papering audit',
    nextActionDate: '2026-09-29',
    priority: 'A',
    lastActivityDate: '2026-09-25',
    needsAttention: false,
    notes: 'Exclusivity executed on Sep 10. Targeting definitive agreement signing late October.',
    foundedYear: 2012,
    employeeCount: 36,
    carrierPartners: ['AXA XL', 'Chubb Global Specialty']
  },
  {
    id: 'opp-4',
    projectName: 'Project Summit',
    entityName: 'Apex Risk Solutions',
    type: 'Platform Acquisition',
    status: 'Active',
    stage: 'IOI / LOI',
    dealLead: 'Mary Sbaschnig',
    sourceType: 'Investment Banker',
    sourceName: 'Dowling & Partners',
    specialty: 'Professional Liability (D&O / E&O for Tech)',
    geography: 'San Francisco, CA',
    nwp: 31000000,
    netRevenue: 5900000,
    pfEbitda: 4500000,
    nextAction: 'Submit revised LOI term sheet with updated earnout structure',
    nextActionDate: '2026-09-24',
    priority: 'A',
    lastActivityDate: '2026-09-24',
    needsAttention: true,
    attentionReasons: [
      {
        type: 'overdue_action',
        label: 'Next Action Overdue',
        description: 'LOI response was promised by end of day yesterday.',
        severity: 'high',
        daysCount: 1
      }
    ],
    notes: 'High-growth automated quoting engine for emerging tech startups. Strong gross margin profile.',
    foundedYear: 2019,
    employeeCount: 24,
    carrierPartners: ['Beazley', 'Hiscox']
  },
  {
    id: 'opp-5',
    projectName: 'Project Atlas',
    entityName: 'Horizon Marine Underwriters',
    type: 'Add-on Acquisition',
    status: 'Active',
    stage: 'Preliminary Discussion',
    dealLead: 'Alex Vance',
    sourceType: 'Carrier Partner',
    sourceName: 'Swiss Re Corporate Solutions Referral',
    specialty: 'Ocean Marine Cargo & Hull',
    geography: 'Seattle, WA',
    nwp: 19500000,
    netRevenue: 3400000,
    pfEbitda: 2800000,
    nextAction: 'Finalize and execute bilateral NDA with principal owners',
    nextActionDate: '2026-10-02',
    priority: 'B',
    lastActivityDate: '2026-09-23',
    needsAttention: false,
    notes: 'Niche marine facility with 14-year underwriting track record and 52% average combined ratio.',
    foundedYear: 2010,
    employeeCount: 18,
    carrierPartners: ['Swiss Re', 'Travelers Ocean Marine']
  },
  {
    id: 'opp-6',
    projectName: 'Project Harbor',
    entityName: 'Northeast Surety & Warranty Group',
    type: 'Organic Growth Initiative',
    status: 'Active',
    stage: 'Target Identified',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Intermediary',
    sourceName: 'MarshBerry',
    specialty: 'Commercial Surety & Warranty Lines',
    geography: 'Boston, MA',
    nwp: 7000000,
    netRevenue: 1300000,
    pfEbitda: 1000000,
    nextAction: 'Initial introductory outreach to majority shareholder',
    nextActionDate: '2026-10-05',
    priority: 'C',
    lastActivityDate: '2026-09-21',
    needsAttention: false,
    notes: 'Boutique surety operation with state-specific bonding licenses in 18 northeastern jurisdictions.',
    foundedYear: 2014,
    employeeCount: 9,
    carrierPartners: ['Liberty Mutual Specialty']
  },
  {
    id: 'opp-7',
    projectName: 'Project Keystone',
    entityName: 'Keystone Energy Underwriting',
    type: 'Carrier Capacity',
    status: 'Pending',
    stage: 'Preliminary Discussion',
    dealLead: 'Mary Sbaschnig',
    sourceType: 'Direct MGA Relationship',
    sourceName: 'Executive Network',
    specialty: 'Renewable Energy & Solar Battery Storage',
    geography: 'Denver, CO',
    nwp: 22000000,
    netRevenue: 3900000,
    pfEbitda: 3100000,
    nextAction: 'Awaiting Q3 financial package from CFO',
    nextActionDate: '2026-10-10',
    priority: 'B',
    lastActivityDate: '2026-08-18',
    needsAttention: true,
    attentionReasons: [
      {
        type: 'stalled_activity',
        label: 'No Activity in 35+ Days',
        description: 'No touchpoint since mid-August pending management team reorg.',
        severity: 'medium',
        daysCount: 38
      }
    ],
    notes: 'High potential in utility-scale solar insurance. Needs restructured fronting carrier arrangement.',
    foundedYear: 2021,
    employeeCount: 15,
    carrierPartners: ['Hanover Insurance']
  },
  {
    id: 'opp-8',
    projectName: 'Project Blue Ridge',
    entityName: 'Appalachian Forestry & Ag Underwriters',
    type: 'Add-on Acquisition',
    status: 'Pending',
    stage: 'Target Identified',
    dealLead: 'Unassigned',
    sourceType: 'Intermediary',
    sourceName: 'Piper Sandler',
    specialty: 'Forestry, Timber, Commercial Agriculture',
    geography: 'Richmond, VA',
    nwp: 14000000,
    netRevenue: 2400000,
    pfEbitda: 1900000,
    nextAction: 'Assign deal lead and evaluate distribution overlap',
    nextActionDate: '2026-10-12',
    priority: 'C',
    lastActivityDate: '2026-09-12',
    needsAttention: true,
    attentionReasons: [
      {
        type: 'no_owner',
        label: 'No Deal Owner Assigned',
        description: 'New teaser received from banker without designated Newport lead.',
        severity: 'low'
      }
    ],
    notes: 'Teaser received last week. Fits Bolt-on strategy for property/inland marine platform.',
    foundedYear: 2016,
    employeeCount: 12,
    carrierPartners: ['Nationwide Agribusiness']
  },
  {
    id: 'opp-9',
    projectName: 'Project Silverline',
    entityName: 'Silverline Cyber & Tech MGA',
    type: 'Platform Acquisition',
    status: 'Pending',
    stage: 'Initial Outreach',
    dealLead: 'Alex Vance',
    sourceType: 'Direct MGA Relationship',
    sourceName: 'Targeting Program',
    specialty: 'SME Cyber Risk & Breach Response',
    geography: 'Austin, TX',
    nwp: 16500000,
    netRevenue: 3100000,
    pfEbitda: 2300000,
    nextAction: 'Follow up on introductory email sent to CEO',
    nextActionDate: '2026-09-30',
    priority: 'B',
    lastActivityDate: '2026-09-20',
    needsAttention: false,
    notes: 'Tech-enabled underwriting platform with proprietary breach monitoring services.',
    foundedYear: 2020,
    employeeCount: 22,
    carrierPartners: ['Canopius', 'Tokio Marine HCC']
  },
  {
    id: 'opp-10',
    projectName: 'Project Trident',
    entityName: 'Trident Aviation & Aerospace Risks',
    type: 'Add-on Acquisition',
    status: 'Pending',
    stage: 'NDA',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Investment Banker',
    sourceName: 'Raymond James',
    specialty: 'General Aviation & Drone Fleet Liability',
    geography: 'Wichita, KS',
    nwp: 11000000,
    netRevenue: 1900000,
    pfEbitda: 1400000,
    nextAction: 'Awaiting signed NDA return from seller legal counsel',
    nextActionDate: '2026-10-01',
    priority: 'B',
    lastActivityDate: '2026-09-19',
    needsAttention: false,
    notes: 'Solid niche operator with 95% renewal retention in non-commercial piston aircraft.',
    foundedYear: 2011,
    employeeCount: 14,
    carrierPartners: ['Starr Aviation', 'Allianz Global Corporate']
  },
  {
    id: 'opp-11',
    projectName: 'Project Calibre',
    entityName: 'Calibre Specialty Casualty',
    type: 'Platform Acquisition',
    status: 'Completed',
    stage: 'Closing',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Investment Banker',
    sourceName: 'Stonemark Partners',
    specialty: 'Excess Casualty & Hospitality',
    geography: 'Chicago, IL',
    nwp: 55000000,
    netRevenue: 9800000,
    pfEbitda: 8100000,
    nextAction: 'Complete 100-day integration milestone tracking',
    nextActionDate: '2026-11-15',
    priority: 'C',
    lastActivityDate: '2026-09-01',
    needsAttention: false,
    notes: 'Successfully closed Q2 2026. Performing +12% above underwriting model plan.',
    foundedYear: 2013,
    employeeCount: 50,
    carrierPartners: ['AIG', 'Sompo International']
  },
  {
    id: 'opp-12',
    projectName: 'Project Paladin',
    entityName: 'Paladin Workers Comp Solutions',
    type: 'Platform Acquisition',
    status: 'Declined',
    stage: 'Initial Review',
    dealLead: 'Mary Sbaschnig',
    sourceType: 'Intermediary',
    sourceName: 'Dowling & Partners',
    specialty: 'High-Hazard Monoline Workers Comp',
    geography: 'Charlotte, NC',
    nwp: 28000000,
    netRevenue: 4100000,
    pfEbitda: 2200000,
    nextAction: 'File archived; send polite pass letter to banker',
    nextActionDate: '2026-08-30',
    priority: 'C',
    lastActivityDate: '2026-08-28',
    needsAttention: false,
    notes: 'Declined due to unfavorable loss trend deterioration in California and New York books.',
    foundedYear: 2015,
    employeeCount: 30,
    carrierPartners: ['AmTrust', 'AF Group']
  },
  {
    id: 'opp-13',
    projectName: 'Project Vanguard Auto',
    entityName: 'Vanguard Non-Standard Commercial Auto',
    type: 'Add-on Acquisition',
    status: 'Withdrew',
    stage: 'Due Diligence',
    dealLead: 'Alex Vance',
    sourceType: 'Investment Banker',
    sourceName: 'MarshBerry',
    specialty: 'Commercial Auto & Last-Mile Delivery',
    geography: 'Dallas, TX',
    nwp: 34000000,
    netRevenue: 5200000,
    pfEbitda: 3600000,
    nextAction: 'Formal withdrawal notice delivered',
    nextActionDate: '2026-08-15',
    priority: 'C',
    lastActivityDate: '2026-08-14',
    needsAttention: false,
    notes: 'Withdrew post-actuarial audit due to unreserved adverse social inflation claims.',
    foundedYear: 2018,
    employeeCount: 26,
    carrierPartners: ['State National', 'Clear Blue']
  },
  {
    id: 'opp-14',
    projectName: 'Project Ironclad',
    entityName: 'Ironclad Construction Programs',
    type: 'Platform Acquisition',
    status: 'Inactive',
    stage: 'NDA',
    dealLead: 'Dennis DiCapua',
    sourceType: 'Direct MGA Relationship',
    sourceName: 'Direct Founder Network',
    specialty: 'Wrap-Up & CCIP Construction Liability',
    geography: 'Phoenix, AZ',
    nwp: 25000000,
    netRevenue: 4000000,
    pfEbitda: 2900000,
    nextAction: 'Re-engage founder in Q1 2027 following capital restructuring',
    nextActionDate: '2027-01-15',
    priority: 'C',
    lastActivityDate: '2026-07-22',
    needsAttention: false,
    notes: 'Seller paused process to complete a proprietary reinsurance renewal.',
    foundedYear: 2016,
    employeeCount: 20,
    carrierPartners: ['Old Republic', 'Ascent Underwriting']
  }
]

export const MOCK_PRIORITY_TASKS: PriorityTask[] = [
  {
    id: 'task-1',
    priority: 'A',
    priorityLabel: 'Must move this week',
    action: 'Submit revised LOI term sheet with updated earnout structure',
    project: 'Project Summit',
    projectId: 'opp-4',
    owner: 'Mary Sbaschnig',
    dueDate: 'Sep 24, 2026',
    daysLeft: -1,
    isOverdue: true
  },
  {
    id: 'task-2',
    priority: 'A',
    priorityLabel: 'Must move this week',
    action: 'Schedule management underwriting deep dive call with Orion CEO',
    project: 'Project Jugular',
    projectId: 'opp-2',
    owner: 'Mary Sbaschnig',
    dueDate: 'Sep 26, 2026',
    daysLeft: 1
  },
  {
    id: 'task-3',
    priority: 'A',
    priorityLabel: 'Must move this week',
    action: 'Review initial CIM & 7-year historical actuarial data pack',
    project: 'Project Guardian',
    projectId: 'opp-1',
    owner: 'Dennis DiCapua',
    dueDate: 'Sep 28, 2026',
    daysLeft: 3
  },
  {
    id: 'task-4',
    priority: 'B',
    priorityLabel: 'Important but can wait',
    action: 'Finalize bilateral NDA and draft exclusivity agreement',
    project: 'Project Atlas',
    projectId: 'opp-5',
    owner: 'Alex Vance',
    dueDate: 'Oct 02, 2026',
    daysLeft: 7
  },
  {
    id: 'task-5',
    priority: 'B',
    priorityLabel: 'Important but can wait',
    action: 'Review A&M Quality of Earnings interim diligence findings',
    project: 'Project Beacon',
    projectId: 'opp-3',
    owner: 'Dennis DiCapua',
    dueDate: 'Oct 03, 2026',
    daysLeft: 8
  }
]

export const MOCK_ATTENTION_ALERTS: AttentionAlert[] = [
  {
    id: 'alert-1',
    type: 'overdue_action',
    title: 'Next Action Overdue (1 Day)',
    description: 'Revised LOI term sheet submission past agreed sponsor deadline.',
    projectName: 'Project Summit',
    projectId: 'opp-4',
    dealLead: 'Mary Sbaschnig',
    daysCount: 1,
    severity: 'high',
    actionNeeded: 'Submit revised LOI term sheet'
  },
  {
    id: 'alert-2',
    type: 'upcoming_deadline',
    title: 'Critical IOI Due Date (4 Days)',
    description: 'First-round indication of interest cutoff for specialty casualty MGA.',
    projectName: 'Project Jugular',
    projectId: 'opp-2',
    dealLead: 'Mary Sbaschnig',
    daysCount: 4,
    severity: 'high',
    actionNeeded: 'Schedule management call & model valuation'
  },
  {
    id: 'alert-3',
    type: 'stalled_activity',
    title: 'Stalled Deal Activity (38 Days)',
    description: 'No active touchpoint or diligence update since mid-August 2026.',
    projectName: 'Project Keystone',
    projectId: 'opp-7',
    dealLead: 'Mary Sbaschnig',
    daysCount: 38,
    severity: 'medium',
    actionNeeded: 'Re-engage CFO for Q3 financials'
  },
  {
    id: 'alert-4',
    type: 'no_owner',
    title: 'Unassigned Deal Owner',
    description: 'Banker teaser received for forestry/ag MGA without designated lead.',
    projectName: 'Project Blue Ridge',
    projectId: 'opp-8',
    dealLead: 'Unassigned',
    severity: 'low',
    actionNeeded: 'Assign Newport lead & evaluate fit'
  }
]

export const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    user: 'Dennis DiCapua',
    avatar: 'DD',
    actionText: 'moved Project Guardian to NDA stage after sponsor clearance',
    projectName: 'Project Guardian',
    projectId: 'opp-1',
    timestamp: '2 hours ago',
    type: 'stage_change'
  },
  {
    id: 'act-2',
    user: 'Mary Sbaschnig',
    avatar: 'MS',
    actionText: 'added diligence underwriting note to Project Beacon',
    projectName: 'Project Beacon',
    projectId: 'opp-3',
    timestamp: '5 hours ago',
    type: 'note'
  },
  {
    id: 'act-3',
    user: 'Alex Vance',
    avatar: 'AV',
    actionText: 'uploaded initial teaser & financial model for Project Jugular',
    projectName: 'Project Jugular',
    projectId: 'opp-2',
    timestamp: 'Yesterday',
    type: 'document'
  },
  {
    id: 'act-4',
    user: 'Dennis DiCapua',
    avatar: 'DD',
    actionText: 'moved Project Summit from Pending to Active pipeline',
    projectName: 'Project Summit',
    projectId: 'opp-4',
    timestamp: 'Yesterday',
    type: 'status_change'
  },
  {
    id: 'act-5',
    user: 'Mary Sbaschnig',
    avatar: 'MS',
    actionText: 'updated LOI valuation terms for Project Atlas',
    projectName: 'Project Atlas',
    projectId: 'opp-5',
    timestamp: '2 days ago',
    type: 'loi_update'
  }
]

export const AI_SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian'
]

export const AI_MOCK_RESPONSES: Record<string, string> = {
  'Which deals need attention?': 
    'There are currently **3 active opportunities and 1 pending opportunity** requiring attention:\n\n' +
    '1. **Project Summit** (Apex Risk Solutions) - Next action is 1 day overdue (Revised LOI submission).\n' +
    '2. **Project Jugular** (Orion Intermediaries) - IOI deadline in 4 days. Management follow-up needed.\n' +
    '3. **Project Keystone** (Keystone Energy) - Stalled for 38 days without active communication.\n' +
    '4. **Project Blue Ridge** (Appalachian Forestry) - Teaser received with no Newport deal lead assigned.\n\n' +
    'Recommendation: Address Project Summit and Project Jugular first this morning.',
  
  'What changed this week?':
    '**Key Highlights across Newport M&A Pipeline (Past 7 Days):**\n\n' +
    '• **Project Guardian**: Executed bilateral NDA; entered initial confidential CIM review ($48.5M NWP / $6.8M EBITDA).\n' +
    '• **Project Summit**: Reactivated from Pending to Active; LOI term sheet negotiations currently active.\n' +
    '• **Project Beacon**: QofE audit initiated with A&M on exclusive platform diligence.\n' +
    '• Total Active Pipeline NWP stands at **$184.0M** across 6 core deals.',

  'Show active deals with no next action':
    'All 6 active deals currently have next action steps assigned. However, **Project Summit** has an **overdue** next action date (Sep 24, 2026), and **Project Blue Ridge** (in Pending status) is currently missing a deal owner and actionable milestone.',

  'Summarize Project Guardian':
    '**Project Guardian Overview (CONFIDENTIAL)**\n\n' +
    '• **Entity**: CrossCover Insurance Services\n' +
    '• **Type**: Platform Acquisition | **Status**: Active | **Stage**: NDA\n' +
    '• **Lead**: Dennis DiCapua | **Source**: Stonemark Partners (Banker)\n' +
    '• **Financials**: $48.5M NWP | $8.2M Net Revenue | $6.8M PF EBITDA (83% margin)\n' +
    '• **Specialty**: Commercial Property & Excess E&S with clean 7-year loss runs\n' +
    '• **Next Step**: Review initial CIM and actuarial data pack by Sep 28, 2026.'
}
