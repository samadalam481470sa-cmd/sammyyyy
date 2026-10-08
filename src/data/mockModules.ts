/**
 * Mock records for the CRM modules (Relationships → Reports).
 * Used to seed the SQLite database and as the static-demo fallback.
 * All names, firms, and figures are fictional.
 */

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
    name: 'Rob Caldwell',
    title: 'CEO',
    company: 'CrossCover Insurance Services',
    category: 'Management',
    email: 'rcaldwell@crosscover.demo',
    phone: '(555) 201-3344',
    opportunityId: 'opp-guardian',
    projectName: 'Project Guardian',
    status: 'Active',
    lastContactDate: '2026-10-03',
    notes: 'Primary management contact; prefers early-morning calls.',
  },
  {
    id: 'con-2',
    name: 'Elena Marsh',
    title: 'Managing Director',
    company: 'Apex Capital Partners',
    category: 'Investment Banker',
    email: 'emarsh@apexcap.demo',
    phone: '(555) 410-8872',
    opportunityId: 'opp-guardian',
    projectName: 'Project Guardian',
    status: 'Active',
    lastContactDate: '2026-10-06',
    notes: 'Sell-side banker on Guardian; also covers Vertex and Ridge.',
  },
  {
    id: 'con-3',
    name: 'David Okafor',
    title: 'Partner, M&A',
    company: 'Hargrove & Lane LLP',
    category: 'Lawyer',
    email: 'dokafor@hargrovelane.demo',
    phone: '(555) 772-9031',
    opportunityId: 'opp-beacon',
    projectName: 'Project Beacon',
    status: 'Active',
    lastContactDate: '2026-10-05',
    notes: 'Outside counsel for LOI and exclusivity language.',
  },
  {
    id: 'con-4',
    name: 'Priya Raman',
    title: 'Transaction Services Partner',
    company: 'Calloway Advisory',
    category: 'Accountant',
    email: 'praman@calloway.demo',
    phone: '(555) 318-6620',
    opportunityId: 'opp-summit',
    projectName: 'Project Summit',
    status: 'Active',
    lastContactDate: '2026-10-07',
    notes: 'Leading QofE for Summit diligence.',
  },
  {
    id: 'con-5',
    name: 'Tom Briggs',
    title: 'President',
    company: 'Orion Intermediaries',
    category: 'Management',
    email: 'tbriggs@orion.demo',
    phone: '(555) 602-1188',
    opportunityId: 'opp-jugular',
    projectName: 'Project Jugular',
    status: 'Active',
    lastContactDate: '2026-09-24',
    notes: 'Awaiting follow-up scheduling; responsive by email.',
  },
  {
    id: 'con-6',
    name: 'Susan Lee',
    title: 'SVP Programs',
    company: 'Pacific Mutual Specialty',
    category: 'Carrier Contact',
    email: 'slee@pacmutual.demo',
    phone: '(555) 845-2210',
    opportunityId: 'opp-harbor',
    projectName: 'Project Harbor',
    status: 'Active',
    lastContactDate: '2026-09-29',
    notes: 'Introduced Harbor; interested in capacity participation.',
  },
  {
    id: 'con-7',
    name: 'Marcus Webb',
    title: 'Director',
    company: 'Clearwater Partners',
    category: 'Investment Banker',
    email: 'mwebb@clearwater.demo',
    phone: '(555) 233-7745',
    opportunityId: 'opp-meridian',
    projectName: 'Project Meridian',
    status: 'Active',
    lastContactDate: '2026-10-01',
    notes: 'Intermediary on Meridian and Summit.',
  },
]

export const mockTasksDb: TaskRecord[] = [
  {
    id: 'task-1',
    priority: 'A',
    action: 'Review initial materials',
    opportunityId: 'opp-guardian',
    projectName: 'Project Guardian',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-10',
    status: 'In Progress',
    notes: 'Data room index received from Apex.',
  },
  {
    id: 'task-2',
    priority: 'A',
    action: 'Schedule follow-up with management',
    opportunityId: 'opp-jugular',
    projectName: 'Project Jugular',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-08',
    status: 'Open',
    notes: 'Tom Briggs available Tue/Thu mornings.',
  },
  {
    id: 'task-3',
    priority: 'A',
    action: 'Call lawyer on exclusivity language',
    opportunityId: 'opp-beacon',
    projectName: 'Project Beacon',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-09',
    status: 'Open',
    notes: 'David Okafor to redline section 4.',
  },
  {
    id: 'task-4',
    priority: 'B',
    action: 'Call accountant re: QofE timeline',
    opportunityId: 'opp-summit',
    projectName: 'Project Summit',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-14',
    status: 'Open',
    notes: 'Priya targeting draft by end of month.',
  },
  {
    id: 'task-5',
    priority: 'B',
    action: 'Confirm exclusivity extension',
    opportunityId: 'opp-atlas',
    projectName: 'Project Atlas',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-15',
    status: 'Open',
    notes: '',
  },
  {
    id: 'task-6',
    priority: 'C',
    action: 'Re-engage banker on stalled outreach',
    opportunityId: 'opp-vertex',
    projectName: 'Project Vertex',
    owner: 'Dennis DiCapua',
    dueDate: '2026-10-20',
    status: 'Open',
    notes: 'No activity since August.',
  },
  {
    id: 'task-7',
    priority: 'C',
    action: 'Assign deal lead',
    opportunityId: 'opp-cipher',
    projectName: 'Project Cipher',
    owner: 'Mary Sbaschnig',
    dueDate: '2026-10-12',
    status: 'Done',
    notes: 'Assigned at Monday partner meeting.',
  },
]

export const mockSources: SourceRecord[] = [
  {
    id: 'src-1',
    name: 'Elena Marsh',
    firm: 'Apex Capital Partners',
    type: 'Investment Banker',
    email: 'emarsh@apexcap.demo',
    phone: '(555) 410-8872',
    status: 'Active',
    dealsReferred: 3,
    notes: 'Strong specialty P&C coverage; referred Guardian, Vertex, Ridge.',
  },
  {
    id: 'src-2',
    name: 'Marcus Webb',
    firm: 'Clearwater Partners',
    type: 'Intermediary',
    email: 'mwebb@clearwater.demo',
    phone: '(555) 233-7745',
    status: 'Active',
    dealsReferred: 3,
    notes: 'Referred Summit, Meridian, Willow.',
  },
  {
    id: 'src-3',
    name: 'Janet Ko',
    firm: 'Meridian Advisory',
    type: 'Investment Banker',
    email: 'jko@meridianadv.demo',
    phone: '(555) 905-4417',
    status: 'Active',
    dealsReferred: 2,
    notes: 'Referred Beacon and Cascade.',
  },
  {
    id: 'src-4',
    name: 'Paul Stern',
    firm: 'Sterling M&A',
    type: 'Investment Banker',
    email: 'pstern@sterlingma.demo',
    phone: '(555) 644-0098',
    status: 'Active',
    dealsReferred: 2,
    notes: 'Referred Atlas and the completed Zenith deal.',
  },
  {
    id: 'src-5',
    name: 'Susan Lee',
    firm: 'Pacific Mutual Specialty',
    type: 'Carrier Partner',
    email: 'slee@pacmutual.demo',
    phone: '(555) 845-2210',
    status: 'Active',
    dealsReferred: 1,
    notes: 'Carrier-side introduction (Harbor).',
  },
]

export const mockCarriers: CarrierRecord[] = [
  {
    id: 'car-1',
    name: 'Pacific Mutual Specialty',
    kind: 'Carrier',
    amBestRating: 'A',
    lines: 'Marine, Inland Marine, Property',
    capacityStatus: 'Active',
    contactName: 'Susan Lee',
    contactEmail: 'slee@pacmutual.demo',
    notes: 'Existing capacity partner; interested in Harbor participation.',
  },
  {
    id: 'car-2',
    name: 'Atlantic Re Specialty',
    kind: 'Reinsurer',
    amBestRating: 'A+',
    lines: 'Casualty, Construction, Excess',
    capacityStatus: 'Active',
    contactName: 'George Hall',
    contactEmail: 'ghall@atlanticre.demo',
    notes: 'Backed the Forge capacity deal.',
  },
  {
    id: 'car-3',
    name: 'Keystone National',
    kind: 'Carrier',
    amBestRating: 'A-',
    lines: 'Workers Comp, Commercial Auto',
    capacityStatus: 'In Discussion',
    contactName: 'Rita Alvarez',
    contactEmail: 'ralvarez@keystonenat.demo',
    notes: 'Evaluating fronting arrangement for Jugular programs.',
  },
  {
    id: 'car-4',
    name: 'Northbridge Syndicate 2201',
    kind: 'Reinsurer',
    amBestRating: 'A',
    lines: 'Cyber, Tech E&O, Management Liability',
    capacityStatus: 'In Discussion',
    contactName: 'Oliver Grant',
    contactEmail: 'ogrant@northbridge.demo',
    notes: 'Potential capacity for Atlas post-close.',
  },
  {
    id: 'car-5',
    name: 'Summit Harbor Assurance',
    kind: 'Carrier',
    amBestRating: 'B++',
    lines: 'Agriculture, Specialty Property',
    capacityStatus: 'Paused',
    contactName: 'Dana White',
    contactEmail: 'dwhite@summitharbor.demo',
    notes: 'Paused pending rating agency review.',
  },
]

export const mockPortfolio: PortfolioRecord[] = [
  {
    id: 'pf-1',
    name: 'Horizon Binding Co.',
    acquiredDate: '2026-04-10',
    specialty: 'Transportation Specialty',
    geography: 'National',
    nwp: 24000000,
    pfEbitda: 3800000,
    integrationStatus: 'Integrating',
    dealLead: 'Mary Sbaschnig',
    notes: 'Project Zenith close; systems migration underway.',
  },
  {
    id: 'pf-2',
    name: 'Ironclad Specialty Programs',
    acquiredDate: '2026-05-20',
    specialty: 'Construction Specialty',
    geography: 'Northeast US',
    nwp: 15000000,
    pfEbitda: 2500000,
    integrationStatus: 'Transition Services',
    dealLead: 'Dennis DiCapua',
    notes: 'Project Forge capacity deal; TSA through Q1 2027.',
  },
  {
    id: 'pf-3',
    name: 'BlueRock Underwriting',
    acquiredDate: '2025-11-02',
    specialty: 'Professional Liability',
    geography: 'National',
    nwp: 31000000,
    pfEbitda: 5400000,
    integrationStatus: 'Integrated',
    dealLead: 'Mary Sbaschnig',
    notes: 'Fully integrated; exceeded year-one plan.',
  },
]

export const mockDocuments: DocumentRecord[] = [
  {
    id: 'doc-1',
    name: 'Guardian - Mutual NDA (executed)',
    docType: 'NDA',
    opportunityId: 'opp-guardian',
    projectName: 'Project Guardian',
    status: 'Executed',
    confidentiality: 'Confidential',
    uploadedBy: 'Dennis DiCapua',
    link: '',
    uploadedAt: '2026-09-25',
    notes: 'Countersigned by CrossCover.',
  },
  {
    id: 'doc-2',
    name: 'Guardian - CIM v2',
    docType: 'Teaser / CIM',
    opportunityId: 'opp-guardian',
    projectName: 'Project Guardian',
    status: 'In Review',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'Elena Marsh (Apex)',
    link: '',
    uploadedAt: '2026-10-02',
    notes: 'Review initial materials task references this.',
  },
  {
    id: 'doc-3',
    name: 'Beacon - LOI draft 3',
    docType: 'LOI',
    opportunityId: 'opp-beacon',
    projectName: 'Project Beacon',
    status: 'Draft',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'David Okafor (H&L)',
    link: '',
    uploadedAt: '2026-10-05',
    notes: 'Exclusivity section under negotiation.',
  },
  {
    id: 'doc-4',
    name: 'Summit - QofE interim findings',
    docType: 'Diligence Report',
    opportunityId: 'opp-summit',
    projectName: 'Project Summit',
    status: 'In Review',
    confidentiality: 'Highly Confidential',
    uploadedBy: 'Priya Raman (Calloway)',
    link: '',
    uploadedAt: '2026-10-07',
    notes: 'Full report expected end of month.',
  },
  {
    id: 'doc-5',
    name: 'Jugular - 3yr financial package',
    docType: 'Financials',
    opportunityId: 'opp-jugular',
    projectName: 'Project Jugular',
    status: 'In Review',
    confidentiality: 'Confidential',
    uploadedBy: 'Tom Briggs (Orion)',
    link: '',
    uploadedAt: '2026-09-24',
    notes: 'Initial materials uploaded by management.',
  },
  {
    id: 'doc-6',
    name: 'Atlas - Exclusivity extension letter',
    docType: 'Legal',
    opportunityId: 'opp-atlas',
    projectName: 'Project Atlas',
    status: 'Draft',
    confidentiality: 'Confidential',
    uploadedBy: 'Dennis DiCapua',
    link: '',
    uploadedAt: '2026-10-06',
    notes: 'Pending signature.',
  },
]
