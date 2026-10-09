/**
 * Mock records for the CRM modules (Relationships → Reports).
 * Used to seed the SQLite database and as the static-demo fallback.
 * Names, firms, and figures are synthetic sample data for illustration only.
 */

import { anonymousEntityName, anonymousProjectName } from '../lib/demoAliases'

export interface ContactRecord {
  id: string
  name: string
  title: string
  company: string
  category: string
  email: string
  phone: string
  opportunityId: string | null
  projectName: string
  status: string
  lastContactDate: string | null
  notes: string
}

export interface TaskRecord {
  id: string
  priority: string
  action: string
  opportunityId: string | null
  projectName: string
  owner: string
  dueDate: string | null
  status: string
  notes: string
}

export interface SourceRecord {
  id: string
  name: string
  firm: string
  type: string
  email: string
  phone: string
  status: string
  dealsReferred: number
  notes: string
}

export interface CarrierRecord {
  id: string
  name: string
  kind: string
  amBestRating: string
  lines: string
  capacityStatus: string
  contactName: string
  contactEmail: string
  notes: string
}

export interface PortfolioRecord {
  id: string
  name: string
  acquiredDate: string | null
  specialty: string
  geography: string
  nwp: number
  pfEbitda: number
  integrationStatus: string
  dealLead: string
  notes: string
}

export interface DocumentRecord {
  id: string
  name: string
  docType: string
  opportunityId: string | null
  projectName: string
  status: string
  confidentiality: string
  uploadedBy: string
  link: string
  uploadedAt: string
  notes: string
}

export const CONTACT_CATEGORIES = [
  'Management',
  'Investment Banker',
  'Lawyer',
  'Accountant',
  'Carrier Contact',
  'Advisor',
  'Other',
] as const

export const CONTACT_STATUSES = ['Active', 'Inactive', 'Do Not Contact'] as const
export const TASK_STATUSES = ['Open', 'In Progress', 'Done'] as const
export const SOURCE_STATUSES = ['Active', 'Inactive'] as const
export const CARRIER_STATUSES = ['Active', 'In Discussion', 'Paused', 'Terminated'] as const
export const INTEGRATION_STATUSES = ['Integrating', 'Integrated', 'Transition Services'] as const
export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Executed', 'Archived'] as const
export const DOCUMENT_TYPES = [
  'NDA',
  'IOI',
  'LOI',
  'Financials',
  'Diligence Report',
  'Legal',
  'Teaser / CIM',
  'Other',
] as const
export const CONFIDENTIALITY_LEVELS = ['Confidential', 'Highly Confidential', 'Internal'] as const

export const mockContacts: ContactRecord[] = [
  {
    id: 'con-1',
    name: 'Alex Rivera',
    title: 'CEO',
    company: anonymousEntityName('opp-a'),
    category: 'Management',
    email: 'alex.rivera@entity-a.demo',
    phone: '(555) 201-3344',
    opportunityId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    status: 'Active',
    lastContactDate: '2026-10-03',
    notes: 'Sample management contact; prefers early-morning calls.',
  },
  {
    id: 'con-2',
    name: 'Jordan Hale',
    title: 'Managing Director',
    company: 'Demo Advisory Group',
    category: 'Investment Banker',
    email: 'jordan.hale@demo-advisory.demo',
    phone: '(555) 410-8872',
    opportunityId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    status: 'Active',
    lastContactDate: '2026-10-06',
    notes: 'Sample sell-side banker; also covers related outreach.',
  },
  {
    id: 'con-3',
    name: 'Casey Quinn',
    title: 'Partner, M&A',
    company: 'Demo Counsel LLP',
    category: 'Lawyer',
    email: 'casey.quinn@demo-counsel.demo',
    phone: '(555) 772-9031',
    opportunityId: 'opp-c',
    projectName: anonymousProjectName('opp-c'),
    status: 'Active',
    lastContactDate: '2026-10-05',
    notes: 'Sample outside counsel for LOI language.',
  },
  {
    id: 'con-4',
    name: 'Riley Chen',
    title: 'Transaction Services Partner',
    company: 'Demo Accounting LLP',
    category: 'Accountant',
    email: 'riley.chen@demo-accounting.demo',
    phone: '(555) 318-6620',
    opportunityId: 'opp-d',
    projectName: anonymousProjectName('opp-d'),
    status: 'Active',
    lastContactDate: '2026-10-07',
    notes: 'Sample QofE workstream owner.',
  },
  {
    id: 'con-5',
    name: 'Morgan Blake',
    title: 'President',
    company: anonymousEntityName('opp-b'),
    category: 'Management',
    email: 'morgan.blake@entity-b.demo',
    phone: '(555) 602-1188',
    opportunityId: 'opp-b',
    projectName: anonymousProjectName('opp-b'),
    status: 'Active',
    lastContactDate: '2026-09-24',
    notes: 'Awaiting sample follow-up scheduling; responsive by email.',
  },
  {
    id: 'con-6',
    name: 'Taylor Brooks',
    title: 'SVP Programs',
    company: 'Demo Capacity Partner',
    category: 'Carrier Contact',
    email: 'taylor.brooks@demo-capacity.demo',
    phone: '(555) 845-2210',
    opportunityId: 'opp-f',
    projectName: anonymousProjectName('opp-f'),
    status: 'Active',
    lastContactDate: '2026-09-29',
    notes: 'Sample carrier-side introduction.',
  },
  {
    id: 'con-7',
    name: 'Avery Cole',
    title: 'Director',
    company: 'Demo Intermediary Desk',
    category: 'Investment Banker',
    email: 'avery.cole@demo-intermediary.demo',
    phone: '(555) 233-7745',
    opportunityId: 'opp-i',
    projectName: anonymousProjectName('opp-i'),
    status: 'Active',
    lastContactDate: '2026-10-01',
    notes: 'Sample intermediary covering two active files.',
  },
]

export const mockTasksDb: TaskRecord[] = [
  {
    id: 'task-1',
    priority: 'A',
    action: 'Review sample materials',
    opportunityId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-10',
    status: 'In Progress',
    notes: 'Sample data room index received.',
  },
  {
    id: 'task-2',
    priority: 'A',
    action: 'Schedule follow-up with management',
    opportunityId: 'opp-b',
    projectName: anonymousProjectName('opp-b'),
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-08',
    status: 'Open',
    notes: 'Sample contact available Tue/Thu mornings.',
  },
  {
    id: 'task-3',
    priority: 'A',
    action: 'Call lawyer on exclusivity language',
    opportunityId: 'opp-c',
    projectName: anonymousProjectName('opp-c'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-09',
    status: 'Open',
    notes: 'Sample redline on exclusivity section.',
  },
  {
    id: 'task-4',
    priority: 'B',
    action: 'Call accountant re: QofE timeline',
    opportunityId: 'opp-d',
    projectName: anonymousProjectName('opp-d'),
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-14',
    status: 'Open',
    notes: 'Sample draft targeted by end of month.',
  },
  {
    id: 'task-5',
    priority: 'B',
    action: 'Confirm exclusivity extension',
    opportunityId: 'opp-e',
    projectName: anonymousProjectName('opp-e'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-15',
    status: 'Open',
    notes: '',
  },
  {
    id: 'task-6',
    priority: 'C',
    action: 'Re-engage banker on stalled outreach',
    opportunityId: 'opp-g',
    projectName: anonymousProjectName('opp-g'),
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-20',
    status: 'Open',
    notes: 'Sample file with no activity since August.',
  },
  {
    id: 'task-7',
    priority: 'C',
    action: 'Assign deal lead',
    opportunityId: 'opp-h',
    projectName: anonymousProjectName('opp-h'),
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-12',
    status: 'Done',
    notes: 'Assigned at Monday partner meeting.',
  },
]

export const mockSources: SourceRecord[] = [
  {
    id: 'src-1',
    name: 'Jordan Hale',
    firm: 'Demo Advisory Group',
    type: 'Investment Banker',
    email: 'jordan.hale@demo-advisory.demo',
    phone: '(555) 410-8872',
    status: 'Active',
    dealsReferred: 3,
    notes: 'Sample specialty P&C coverage; referred three demo files.',
  },
  {
    id: 'src-2',
    name: 'Avery Cole',
    firm: 'Demo Intermediary Desk',
    type: 'Intermediary',
    email: 'avery.cole@demo-intermediary.demo',
    phone: '(555) 233-7745',
    status: 'Active',
    dealsReferred: 3,
    notes: 'Sample intermediary coverage.',
  },
  {
    id: 'src-3',
    name: 'Jamie Ortiz',
    firm: 'Demo Placement Office',
    type: 'Investment Banker',
    email: 'jamie.ortiz@demo-placement.demo',
    phone: '(555) 905-4417',
    status: 'Active',
    dealsReferred: 2,
    notes: 'Sample banker coverage.',
  },
  {
    id: 'src-4',
    name: 'Sam Patel',
    firm: 'Demo Banker Collective',
    type: 'Investment Banker',
    email: 'sam.patel@demo-banker.demo',
    phone: '(555) 644-0098',
    status: 'Active',
    dealsReferred: 2,
    notes: 'Sample completed-file coverage.',
  },
  {
    id: 'src-5',
    name: 'Taylor Brooks',
    firm: 'Demo Capacity Partner',
    type: 'Carrier Partner',
    email: 'taylor.brooks@demo-capacity.demo',
    phone: '(555) 845-2210',
    status: 'Active',
    dealsReferred: 1,
    notes: 'Sample carrier-side introduction.',
  },
]

export const mockCarriers: CarrierRecord[] = [
  {
    id: 'car-1',
    name: 'Demo Capacity Partner',
    kind: 'Carrier',
    amBestRating: 'A',
    lines: 'Marine, Inland Marine, Property',
    capacityStatus: 'Active',
    contactName: 'Taylor Brooks',
    contactEmail: 'taylor.brooks@demo-capacity.demo',
    notes: 'Sample capacity partner for illustration.',
  },
  {
    id: 'car-2',
    name: 'Demo Reinsurance Desk',
    kind: 'Reinsurer',
    amBestRating: 'A+',
    lines: 'Casualty, Construction, Excess',
    capacityStatus: 'Active',
    contactName: 'Chris Nguyen',
    contactEmail: 'chris.nguyen@demo-reinsurance.demo',
    notes: 'Sample capacity on a closed demo file.',
  },
  {
    id: 'car-3',
    name: 'Demo Fronting Carrier',
    kind: 'Carrier',
    amBestRating: 'A-',
    lines: 'Workers Comp, Commercial Auto',
    capacityStatus: 'In Discussion',
    contactName: 'Reese Alvarez',
    contactEmail: 'reese.alvarez@demo-fronting.demo',
    notes: 'Sample fronting discussion (demo).',
  },
  {
    id: 'car-4',
    name: 'Demo Syndicate Desk',
    kind: 'Reinsurer',
    amBestRating: 'A',
    lines: 'Cyber, Tech E&O, Management Liability',
    capacityStatus: 'In Discussion',
    contactName: 'Elliot Grant',
    contactEmail: 'elliot.grant@demo-syndicate.demo',
    notes: 'Sample post-close capacity (demo).',
  },
  {
    id: 'car-5',
    name: 'Demo Specialty Assurance',
    kind: 'Carrier',
    amBestRating: 'B++',
    lines: 'Agriculture, Specialty Property',
    capacityStatus: 'Paused',
    contactName: 'Dana White',
    contactEmail: 'dana.white@demo-assurance.demo',
    notes: 'Paused pending a sample rating review.',
  },
]

export const mockPortfolio: PortfolioRecord[] = [
  {
    id: 'pf-1',
    name: anonymousEntityName('opp-m'),
    acquiredDate: '2026-04-10',
    specialty: 'Transportation Specialty',
    geography: 'National',
    nwp: 13_000_000,
    pfEbitda: 1_300_000,
    integrationStatus: 'Integrating',
    dealLead: 'Mary Sbaschnig',
    notes: `${anonymousProjectName('opp-m')} sample close — systems migration underway (demo).`,
  },
  {
    id: 'pf-2',
    name: anonymousEntityName('opp-l'),
    acquiredDate: '2026-05-20',
    specialty: 'Construction Specialty',
    geography: 'Northeast US',
    nwp: 16_000_000,
    pfEbitda: 1_600_000,
    integrationStatus: 'Transition Services',
    dealLead: 'Dennis DiCapua',
    notes: `${anonymousProjectName('opp-l')} sample capacity deal; TSA through Q1 2027 (demo).`,
  },
  {
    id: 'pf-3',
    name: 'Demo Portfolio Company 1',
    acquiredDate: '2025-11-02',
    specialty: 'Professional Liability',
    geography: 'National',
    nwp: 12_000_000,
    pfEbitda: 1_200_000,
    integrationStatus: 'Integrated',
    dealLead: 'Mary Sbaschnig',
    notes: 'Fully integrated sample platform (demo).',
  },
]

export const mockDocuments: DocumentRecord[] = [
  {
    id: 'doc-1',
    name: `${anonymousProjectName('opp-a')} - Mutual NDA (sample)`,
    docType: 'NDA',
    opportunityId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    status: 'Executed',
    confidentiality: 'Confidential',
    uploadedBy: 'Dennis DiCapua',
    link: '',
    uploadedAt: '2026-09-25',
    notes: 'Sample countersignature on file.',
  },
  {
    id: 'doc-2',
    name: `${anonymousProjectName('opp-a')} - CIM v2 (sample)`,
    docType: 'Teaser / CIM',
    opportunityId: 'opp-a',
    projectName: anonymousProjectName('opp-a'),
    status: 'In Review',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'Jordan Hale',
    link: '',
    uploadedAt: '2026-10-02',
    notes: 'Sample materials for the review task.',
  },
  {
    id: 'doc-3',
    name: `${anonymousProjectName('opp-c')} - LOI draft 3 (sample)`,
    docType: 'LOI',
    opportunityId: 'opp-c',
    projectName: anonymousProjectName('opp-c'),
    status: 'Draft',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'Casey Quinn',
    link: '',
    uploadedAt: '2026-10-05',
    notes: 'Sample exclusivity section under negotiation.',
  },
  {
    id: 'doc-4',
    name: `${anonymousProjectName('opp-d')} - QofE interim findings (sample)`,
    docType: 'Diligence Report',
    opportunityId: 'opp-d',
    projectName: anonymousProjectName('opp-d'),
    status: 'In Review',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'Riley Chen',
    link: '',
    uploadedAt: '2026-10-07',
    notes: 'Sample report expected end of month.',
  },
  {
    id: 'doc-5',
    name: `${anonymousProjectName('opp-b')} - 3yr financial package (sample)`,
    docType: 'Financials',
    opportunityId: 'opp-b',
    projectName: anonymousProjectName('opp-b'),
    status: 'In Review',
    confidentiality: 'Confidential',
    uploadedBy: 'Morgan Blake',
    link: '',
    uploadedAt: '2026-09-24',
    notes: 'Sample materials uploaded by management.',
  },
  {
    id: 'doc-6',
    name: `${anonymousProjectName('opp-e')} - Exclusivity extension letter (sample)`,
    docType: 'Legal',
    opportunityId: 'opp-e',
    projectName: anonymousProjectName('opp-e'),
    status: 'Draft',
    confidentiality: 'Confidential',
    uploadedBy: 'Dennis DiCapua',
    link: '',
    uploadedAt: '2026-10-06',
    notes: 'Pending sample signature.',
  },
]
