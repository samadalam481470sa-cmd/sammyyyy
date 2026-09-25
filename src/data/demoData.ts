import { evaluateAttention } from "../lib/attention.ts"
import { isoDate } from "../lib/dates.ts"
import type {
  AcquisitionStage,
  ActivityItem,
  ActivityKind,
  CrmSnapshot,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  Priority,
  PriorityTask,
  SourceType,
} from "../types/crm.ts"

interface DealSeed {
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
  nextActionOffset: number | null
  priority: Priority | null
  lastActivityOffset: number
  criticalDeadlineOffset?: number | null
}

function materialize(seed: DealSeed, today: Date): Opportunity {
  const nextActionDate = seed.nextActionOffset === null ? null : isoDate(today, seed.nextActionOffset)
  const lastActivityDate = isoDate(today, seed.lastActivityOffset)
  const criticalDeadline =
    seed.criticalDeadlineOffset == null ? null : isoDate(today, seed.criticalDeadlineOffset)
  const attention = evaluateAttention(
    {
      status: seed.status,
      dealLead: seed.dealLead,
      nextAction: seed.nextAction,
      nextActionDate,
      lastActivityDate,
      criticalDeadline,
    },
    today,
  )

  return {
    id: seed.id,
    projectName: seed.projectName,
    entityName: seed.entityName,
    type: seed.type,
    status: seed.status,
    stage: seed.stage,
    dealLead: seed.dealLead,
    sourceType: seed.sourceType,
    sourceName: seed.sourceName,
    specialty: seed.specialty,
    geography: seed.geography,
    nwp: seed.nwp,
    netRevenue: seed.netRevenue,
    pfEbitda: seed.pfEbitda,
    nextAction: seed.nextAction,
    nextActionDate,
    priority: seed.priority,
    lastActivityDate,
    criticalDeadline,
    needsAttention: attention.needsAttention,
    attentionReason: attention.attentionReason,
  }
}

const DEAL_SEEDS: DealSeed[] = [
  {
    id: "guardian",
    projectName: "Project Guardian",
    entityName: "CrossCover Insurance Services",
    type: "Platform Acquisition",
    status: "Active",
    stage: "NDA",
    dealLead: "Dennis DiCapua",
    sourceType: "Investment Banker",
    sourceName: "Whitmore Capital Advisors",
    specialty: "Excess Casualty",
    geography: "National",
    nwp: 42_000_000,
    netRevenue: 7_560_000,
    pfEbitda: 6_200_000,
    nextAction: "Review initial materials",
    nextActionOffset: 3,
    priority: "A",
    lastActivityOffset: -1,
  },
  {
    id: "jugular",
    projectName: "Project Jugular",
    entityName: "Orion Intermediaries",
    type: "Platform Acquisition",
    status: "Active",
    stage: "Initial Review",
    dealLead: "Mary Sbaschnig",
    sourceType: "Intermediary",
    sourceName: "Pell & Ames",
    specialty: "Specialty Commercial",
    geography: "Northeast",
    nwp: 28_500_000,
    netRevenue: 4_845_000,
    pfEbitda: 3_800_000,
    nextAction: "Schedule follow-up",
    nextActionOffset: 2,
    priority: "A",
    lastActivityOffset: 0,
  },
  {
    id: "beacon",
    projectName: "Project Beacon",
    entityName: "Northline Specialty Underwriters",
    type: "Add-on Acquisition",
    status: "Active",
    stage: "Initial Review",
    dealLead: "Mary Sbaschnig",
    sourceType: "Direct MGA Relationship",
    sourceName: "Direct",
    specialty: "Professional Lines",
    geography: "Midwest",
    nwp: 31_000_000,
    netRevenue: 5_270_000,
    pfEbitda: 4_100_000,
    nextAction: "Re-engage management on process timing",
    nextActionOffset: 18,
    priority: "B",
    lastActivityOffset: -42,
  },
  {
    id: "summit",
    projectName: "Project Summit",
    entityName: "Halcyon Program Administrators",
    type: "Platform Acquisition",
    status: "Active",
    stage: "IOI / LOI",
    dealLead: "Elena Voss",
    sourceType: "Investment Banker",
    sourceName: "Whitmore Capital Advisors",
    specialty: "Transportation",
    geography: "National",
    nwp: 22_000_000,
    netRevenue: 3_960_000,
    pfEbitda: 3_200_000,
    nextAction: "Circulate revised LOI",
    nextActionOffset: 5,
    priority: "A",
    lastActivityOffset: -1,
  },
  {
    id: "atlas",
    projectName: "Project Atlas",
    entityName: "Redwood Risk Partners",
    type: "Add-on Acquisition",
    status: "Active",
    stage: "Due Diligence",
    dealLead: "James Okonkwo",
    sourceType: "Intermediary",
    sourceName: "Pell & Ames",
    specialty: "Habitational",
    geography: "Southeast",
    nwp: 18_500_000,
    netRevenue: 3_145_000,
    pfEbitda: 2_600_000,
    nextAction: "Issue diligence request list",
    nextActionOffset: 8,
    priority: "A",
    lastActivityOffset: -2,
  },
  {
    id: "harbor",
    projectName: "Project Harbor",
    entityName: "Fieldstone MGA Group",
    type: "Platform Acquisition",
    status: "Active",
    stage: "Preliminary Discussion",
    dealLead: "Dennis DiCapua",
    sourceType: "Direct MGA Relationship",
    sourceName: "Direct",
    specialty: "Environmental",
    geography: "West",
    nwp: 15_000_000,
    netRevenue: 2_550_000,
    pfEbitda: 2_400_000,
    nextAction: "Send discussion follow-up",
    nextActionOffset: -3,
    priority: "A",
    lastActivityOffset: -4,
  },
  {
    id: "meridian",
    projectName: "Project Meridian",
    entityName: "Coastal Bind Solutions",
    type: "Add-on Acquisition",
    status: "Active",
    stage: "Initial Outreach",
    dealLead: "Priya Raman",
    sourceType: "Carrier Partner",
    sourceName: "Hartwell Specialty",
    specialty: "Marine",
    geography: "Gulf Coast",
    nwp: 16_000_000,
    netRevenue: 2_720_000,
    pfEbitda: 2_300_000,
    nextAction: "Confirm introductory meeting",
    nextActionOffset: 12,
    priority: "B",
    lastActivityOffset: -3,
  },
  {
    id: "keystone",
    projectName: "Project Keystone",
    entityName: "Apex Wholesale Programs",
    type: "Organic Growth Initiative",
    status: "Active",
    stage: "Target Identified",
    dealLead: "Thomas Ellery",
    sourceType: "Other",
    sourceName: "Internal sourcing",
    specialty: "Surety",
    geography: "Mid-Atlantic",
    nwp: 11_000_000,
    netRevenue: 1_870_000,
    pfEbitda: 1_800_000,
    nextAction: "Complete target profile",
    nextActionOffset: 15,
    priority: "C",
    lastActivityOffset: -6,
  },
  {
    id: "lumen",
    projectName: "Project Lumen",
    entityName: "BrightPath Specialty",
    type: "Platform Acquisition",
    status: "Pending",
    stage: "NDA",
    dealLead: "Elena Voss",
    sourceType: "Investment Banker",
    sourceName: "Langford Rowe",
    specialty: "Cyber",
    geography: "National",
    nwp: 19_000_000,
    netRevenue: 3_230_000,
    pfEbitda: 2_900_000,
    nextAction: "Await management presentation date",
    nextActionOffset: 9,
    priority: "B",
    lastActivityOffset: -5,
  },
  {
    id: "vanguard",
    projectName: "Project Vanguard",
    entityName: "Silverline General Agency",
    type: "Add-on Acquisition",
    status: "Pending",
    stage: "Preliminary Discussion",
    dealLead: "James Okonkwo",
    sourceType: "Intermediary",
    sourceName: "Pell & Ames",
    specialty: "Energy",
    geography: "Texas",
    nwp: 14_500_000,
    netRevenue: 2_465_000,
    pfEbitda: 1_900_000,
    nextAction: "Decide whether to continue discussions",
    nextActionOffset: 7,
    priority: "B",
    lastActivityOffset: -8,
  },
  {
    id: "northstar",
    projectName: "Project Northstar",
    entityName: "Marlowe & Co. Programs",
    type: "Platform Acquisition",
    status: "Pending",
    stage: "Initial Outreach",
    dealLead: "Priya Raman",
    sourceType: "Direct MGA Relationship",
    sourceName: "Direct",
    specialty: "Miscellaneous Professional",
    geography: "National",
    nwp: 9_800_000,
    netRevenue: 1_666_000,
    pfEbitda: 1_200_000,
    nextAction: null,
    nextActionOffset: null,
    priority: "C",
    lastActivityOffset: -2,
  },
  {
    id: "cobalt",
    projectName: "Project Cobalt",
    entityName: "Highwater Underwriting",
    type: "Carrier Capacity",
    status: "Pending",
    stage: "IOI / LOI",
    dealLead: "Thomas Ellery",
    sourceType: "Carrier Partner",
    sourceName: "Hartwell Specialty",
    specialty: "Property",
    geography: "National",
    nwp: 27_000_000,
    netRevenue: 1_350_000,
    pfEbitda: 900_000,
    nextAction: "Review capacity proposal",
    nextActionOffset: 11,
    priority: "B",
    lastActivityOffset: -4,
  },
  {
    id: "pinnacle",
    projectName: "Project Pinnacle",
    entityName: "Stonebridge MGA",
    type: "Add-on Acquisition",
    status: "Inactive",
    stage: "Initial Review",
    dealLead: "Dennis DiCapua",
    sourceType: "Investment Banker",
    sourceName: "Langford Rowe",
    specialty: "Workers Compensation",
    geography: "Midwest",
    nwp: 12_000_000,
    netRevenue: 2_040_000,
    pfEbitda: 1_500_000,
    nextAction: "Hold pending sponsor direction",
    nextActionOffset: 30,
    priority: "C",
    lastActivityOffset: -12,
  },
  {
    id: "redwood",
    projectName: "Project Redwood",
    entityName: "Evergreen Specialty",
    type: "Organic Growth Initiative",
    status: "Inactive",
    stage: "Target Identified",
    dealLead: "Mary Sbaschnig",
    sourceType: "Other",
    sourceName: "Internal sourcing",
    specialty: "Farm and Ranch",
    geography: "Plains",
    nwp: 6_400_000,
    netRevenue: 1_088_000,
    pfEbitda: 740_000,
    nextAction: "Revisit in the next quarterly review",
    nextActionOffset: 45,
    priority: "C",
    lastActivityOffset: -20,
  },
  {
    id: "lantern",
    projectName: "Project Lantern",
    entityName: "Cinder Peak Specialty",
    type: "Platform Acquisition",
    status: "Declined",
    stage: "Initial Review",
    dealLead: "Elena Voss",
    sourceType: "Investment Banker",
    sourceName: "Whitmore Capital Advisors",
    specialty: "Construction",
    geography: "Southwest",
    nwp: 21_000_000,
    netRevenue: 3_570_000,
    pfEbitda: 2_200_000,
    nextAction: "Archive decline rationale",
    nextActionOffset: -10,
    priority: null,
    lastActivityOffset: -25,
  },
  {
    id: "ironclad",
    projectName: "Project Ironclad",
    entityName: "Westford Program Managers",
    type: "Add-on Acquisition",
    status: "Declined",
    stage: "Preliminary Discussion",
    dealLead: "James Okonkwo",
    sourceType: "Intermediary",
    sourceName: "Pell & Ames",
    specialty: "Casualty",
    geography: "National",
    nwp: 8_200_000,
    netRevenue: 1_394_000,
    pfEbitda: 640_000,
    nextAction: null,
    nextActionOffset: null,
    priority: null,
    lastActivityOffset: -40,
  },
  {
    id: "sable",
    projectName: "Project Sable",
    entityName: "Graybar Intermediaries",
    type: "Platform Acquisition",
    status: "Closed",
    stage: "Due Diligence",
    dealLead: "Dennis DiCapua",
    sourceType: "Investment Banker",
    sourceName: "Langford Rowe",
    specialty: "Specialty Auto",
    geography: "Southeast",
    nwp: 17_400_000,
    netRevenue: 2_958_000,
    pfEbitda: 2_100_000,
    nextAction: "Close the working file",
    nextActionOffset: 14,
    priority: null,
    lastActivityOffset: -15,
  },
  {
    id: "cascade",
    projectName: "Project Cascade",
    entityName: "Dunewood MGA",
    type: "Add-on Acquisition",
    status: "Withdrew",
    stage: "NDA",
    dealLead: "Priya Raman",
    sourceType: "Direct MGA Relationship",
    sourceName: "Direct",
    specialty: "Hospitality",
    geography: "Florida",
    nwp: 10_200_000,
    netRevenue: 1_734_000,
    pfEbitda: 980_000,
    nextAction: "Note withdrawal in the file",
    nextActionOffset: 10,
    priority: null,
    lastActivityOffset: -18,
  },
  {
    id: "oakmont",
    projectName: "Project Oakmont",
    entityName: "Oakmont Specialty Group",
    type: "Platform Acquisition",
    status: "Completed",
    stage: "Closing",
    dealLead: "Mary Sbaschnig",
    sourceType: "Investment Banker",
    sourceName: "Whitmore Capital Advisors",
    specialty: "General Liability Programs",
    geography: "National",
    nwp: 36_000_000,
    netRevenue: 6_120_000,
    pfEbitda: 5_400_000,
    nextAction: "Transition to portfolio oversight",
    nextActionOffset: 20,
    priority: null,
    lastActivityOffset: -7,
  },
]

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString()
}

function buildTasks(today: Date): PriorityTask[] {
  const due = (offset: number) => isoDate(today, offset)
  return [
    {
      id: "task-guardian-materials",
      priority: "A",
      action: "Review initial materials",
      projectId: "guardian",
      owner: "Dennis DiCapua",
      dueDate: due(0),
    },
    {
      id: "task-jugular-followup",
      priority: "A",
      action: "Schedule follow-up",
      projectId: "jugular",
      owner: "Mary Sbaschnig",
      dueDate: due(1),
    },
    {
      id: "task-summit-loi",
      priority: "A",
      action: "Circulate revised LOI",
      projectId: "summit",
      owner: "Elena Voss",
      dueDate: due(2),
    },
    {
      id: "task-atlas-diligence",
      priority: "B",
      action: "Issue diligence request list",
      projectId: "atlas",
      owner: "James Okonkwo",
      dueDate: due(4),
    },
    {
      id: "task-beacon-monitor",
      priority: "C",
      action: "Monitor for a response from management",
      projectId: "beacon",
      owner: "Mary Sbaschnig",
      dueDate: due(6),
    },
  ]
}

function buildActivities(now: Date): ActivityItem[] {
  const items: Array<{ id: string; projectId: string; message: string; hours: number; kind: ActivityKind }> = [
    {
      id: "act-guardian-nda",
      projectId: "guardian",
      message: "Dennis moved Project Guardian to NDA",
      hours: 2,
      kind: "stage",
    },
    {
      id: "act-beacon-note",
      projectId: "beacon",
      message: "Mary added a note to Project Beacon",
      hours: 5,
      kind: "note",
    },
    {
      id: "act-jugular-upload",
      projectId: "jugular",
      message: "Initial materials uploaded for Project Jugular",
      hours: 26,
      kind: "document",
    },
    {
      id: "act-summit-status",
      projectId: "summit",
      message: "Project Summit moved from Pending to Active",
      hours: 30,
      kind: "status",
    },
    {
      id: "act-atlas-loi",
      projectId: "atlas",
      message: "LOI updated for Project Atlas",
      hours: 50,
      kind: "terms",
    },
  ]

  return items.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    message: item.message,
    occurredAt: hoursAgo(now, item.hours),
    kind: item.kind,
  }))
}

export function createDemoDataset(now = new Date()): CrmSnapshot {
  return {
    asOf: now.toISOString(),
    opportunities: DEAL_SEEDS.map((seed) => materialize(seed, now)),
    tasks: buildTasks(now),
    activities: buildActivities(now),
  }
}

export function warnIfDemoDrift(snapshot: CrmSnapshot): void {
  if (!import.meta.env.DEV) return
  const active = snapshot.opportunities.filter((item) => item.status === "Active")
  const pending = snapshot.opportunities.filter((item) => item.status === "Pending")
  const attention = snapshot.opportunities.filter((item) => item.needsAttention)
  const nwp = active.reduce((sum, item) => sum + item.nwp, 0)
  const ebitda = active.reduce((sum, item) => sum + item.pfEbitda, 0)
  const guardian = snapshot.opportunities.find((item) => item.id === "guardian")
  const jugular = snapshot.opportunities.find((item) => item.id === "jugular")
  const problems: string[] = []
  if (active.length !== 8) problems.push(`active ${active.length}`)
  if (pending.length !== 4) problems.push(`pending ${pending.length}`)
  if (attention.length !== 3) problems.push(`attention ${attention.length}`)
  if (nwp !== 184_000_000) problems.push(`nwp ${nwp}`)
  if (ebitda !== 26_400_000) problems.push(`ebitda ${ebitda}`)
  if (guardian?.stage !== "NDA" || guardian.nextAction !== "Review initial materials") {
    problems.push("guardian")
  }
  if (jugular?.stage !== "Initial Review" || jugular.dealLead !== "Mary Sbaschnig") {
    problems.push("jugular")
  }
  if (problems.length > 0) {
    console.warn("Demo dataset drifted from the dashboard examples:", problems.join(", "))
  }
}

/**
 * Async seam for a future API. The dashboard currently hydrates from
 * `createDemoDataset` so the first paint does not flash a loading state.
 */
export async function loadDashboardSnapshot(): Promise<CrmSnapshot> {
  return createDemoDataset(new Date())
}
