import type { ActivityItem, ActivityType, Opportunity } from '@/types'
import type { TaskRecord } from '@/data/mockModules'
import type { DocumentRecord } from '@/data/mockModules'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { nowIso } from '@/lib/calendarDate'

function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function makeActivity(input: {
  actor: string | null
  message: string
  projectName: string
  projectId?: string
  type: ActivityType
  timestamp?: string
  targetType?: ActivityItem['targetType']
  targetId?: string
}): ActivityItem {
  return {
    id: activityId(),
    actor: input.actor,
    message: input.message,
    projectName: input.projectName,
    projectId: input.projectId,
    timestamp: input.timestamp ?? nowIso(),
    type: input.type,
    targetType: input.targetType,
    targetId: input.targetId,
  }
}

export function opportunityCreateActivity(actor: string | null, opportunity: Opportunity): ActivityItem {
  return makeActivity({
    actor,
    type: 'create',
    projectId: opportunity.id,
    projectName: opportunity.projectName,
    message: `created ${opportunity.projectName} (${dealIdFromOpportunity(opportunity)})`,
    targetType: 'opportunity',
    targetId: opportunity.id,
  })
}

export function opportunityUpdateActivity(
  actor: string | null,
  before: Opportunity,
  patch: Partial<Opportunity>,
): ActivityItem | null {
  const parts: string[] = []
  let type: ActivityType = 'update'
  if (patch.status && patch.status !== before.status) {
    parts.push(`changed status of ${before.projectName} from ${before.status} to ${patch.status}`)
    type = 'status_change'
  }
  if (patch.stage && patch.stage !== before.stage) {
    parts.push(`moved ${before.projectName} from ${before.stage} to ${patch.stage}`)
    type = parts.length === 1 ? 'stage_change' : 'update'
  }
  if (
    (patch.nextAction !== undefined && patch.nextAction !== before.nextAction) ||
    (patch.nextActionDate !== undefined && patch.nextActionDate !== before.nextActionDate) ||
    (patch.priority !== undefined && patch.priority !== before.priority)
  ) {
    parts.push(`updated next action on ${before.projectName}`)
  }
  const tracked = [
    'projectName',
    'entityName',
    'dealLead',
    'type',
    'nwp',
    'netRevenue',
    'pfEbitda',
    'diligenceNotes',
    'outstandingItems',
  ] as const
  const other = tracked.some((key) => patch[key] !== undefined && patch[key] !== before[key])
  if (!parts.length && other) {
    parts.push(`edited ${before.projectName}`)
  }
  if (!parts.length) return null
  return makeActivity({
    actor,
    type,
    projectId: before.id,
    projectName: before.projectName,
    message: parts.join('; '),
    targetType: 'opportunity',
    targetId: before.id,
  })
}

export function opportunityDeleteActivity(actor: string | null, opportunity: Opportunity): ActivityItem {
  return makeActivity({
    actor,
    type: 'delete',
    projectId: opportunity.id,
    projectName: opportunity.projectName,
    message: `deleted ${opportunity.projectName} (${dealIdFromOpportunity(opportunity)})`,
    targetType: 'opportunity',
    targetId: opportunity.id,
  })
}

export function taskActivity(
  actor: string | null,
  task: TaskRecord,
  verb: string,
  type: ActivityType = 'task',
): ActivityItem {
  const project = task.projectName || 'an unlinked deal'
  return makeActivity({
    actor,
    type,
    projectId: task.opportunityId ?? undefined,
    projectName: task.projectName || '',
    message: `${verb} task “${task.action || 'Untitled'}” on ${project}`,
    targetType: 'task',
    targetId: task.id,
  })
}

export function documentActivity(
  actor: string | null,
  doc: DocumentRecord,
  verb: string,
): ActivityItem {
  const project = doc.projectName || 'an unlinked deal'
  return makeActivity({
    actor,
    type: 'document',
    projectId: doc.opportunityId ?? undefined,
    projectName: doc.projectName || '',
    message: `${verb} document “${doc.name || doc.docType}” on ${project}`,
    targetType: 'document',
    targetId: doc.id,
  })
}
