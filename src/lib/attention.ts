import { ATTENTION_REASONS, type AttentionReason, type OpportunityStatus } from "../types/crm.ts"
import { daysFromToday } from "./dates.ts"

export interface AttentionInput {
  status: OpportunityStatus
  dealLead: string | null
  nextAction: string | null
  nextActionDate: string | null
  lastActivityDate: string
  criticalDeadline: string | null
}

function isAttentionEligible(status: OpportunityStatus): boolean {
  return status === "Active" || status === "Pending"
}

export function evaluateAttention(
  input: AttentionInput,
  today: Date,
): { needsAttention: boolean; attentionReason: AttentionReason | null } {
  if (!isAttentionEligible(input.status)) {
    return { needsAttention: false, attentionReason: null }
  }

  const reasons = new Set<AttentionReason>()

  if (!input.dealLead?.trim()) reasons.add("No deal owner assigned")
  if (!input.nextAction?.trim()) reasons.add("No next action assigned")

  if (input.nextActionDate && daysFromToday(input.nextActionDate, today) < 0) {
    reasons.add("Next action overdue")
  }

  if (input.criticalDeadline) {
    const delta = daysFromToday(input.criticalDeadline, today)
    if (delta >= 0 && delta <= 7) reasons.add("Upcoming deadline within 7 days")
  }

  if (daysFromToday(input.lastActivityDate, today) <= -30) {
    reasons.add("No activity in 30+ days")
  }

  const attentionReason = ATTENTION_REASONS.find((reason) => reasons.has(reason)) ?? null
  return { needsAttention: attentionReason !== null, attentionReason }
}
