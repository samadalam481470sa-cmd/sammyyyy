import { evaluateAttention } from "./attention.ts"
import { isoDate } from "./dates.ts"
import type {
  ActivityItem,
  NewActivityInput,
  NewOpportunityInput,
  NewTaskInput,
  Opportunity,
  PriorityTask,
} from "../types/crm.ts"

function millionsToDollars(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1_000_000)
}

export function createOpportunityRecord(input: NewOpportunityInput, today: Date): Opportunity {
  const dealLead = input.dealLead.trim() || null
  const nextAction = input.nextAction.trim() || null
  const nextActionDate = input.nextActionDate.trim() || null
  const lastActivityDate = isoDate(today, 0)
  const attention = evaluateAttention(
    {
      status: input.status,
      dealLead,
      nextAction,
      nextActionDate,
      lastActivityDate,
      criticalDeadline: null,
    },
    today,
  )

  return {
    id: crypto.randomUUID(),
    projectName: input.projectName.trim(),
    entityName: input.entityName.trim(),
    type: input.type,
    status: input.status,
    stage: input.stage,
    dealLead,
    sourceType: "Other",
    sourceName: "Internal",
    specialty: "General",
    geography: "National",
    nwp: millionsToDollars(input.nwpMillions),
    netRevenue: millionsToDollars(input.netRevenueMillions),
    pfEbitda: millionsToDollars(input.pfEbitdaMillions),
    nextAction,
    nextActionDate,
    priority: input.priority,
    lastActivityDate,
    criticalDeadline: null,
    needsAttention: attention.needsAttention,
    attentionReason: attention.attentionReason,
  }
}

export function createTaskRecord(input: NewTaskInput): PriorityTask {
  return {
    id: crypto.randomUUID(),
    priority: input.priority,
    action: input.action.trim(),
    projectId: input.projectId,
    owner: input.owner.trim(),
    dueDate: input.dueDate,
  }
}

export function createActivityRecord(input: NewActivityInput, today: Date): ActivityItem {
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    message: input.message.trim(),
    occurredAt: today.toISOString(),
    kind: input.kind,
  }
}
