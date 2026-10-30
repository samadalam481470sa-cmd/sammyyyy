/**
 * Repairs for known problems in older fictional starter records (Oct 30, 2026 fix list).
 * Each fix applies only while the record still holds the exact old value, so a user's own
 * later edit is never overwritten and running it again changes nothing.
 */
import type { Opportunity } from '@/types'

/** Completed starter deals that were left at an earlier stage. */
const COMPLETED_STAGE_FIX: Record<string, Opportunity['stage']> = {
  'opp-q': 'Due Diligence',
  'opp-x': 'IOI / LOI',
  'opp-ae': 'NDA',
  'opp-al': 'Initial Outreach',
}

/** Starter deals assigned to "Alex Rivera" (not a CRM user) or to nobody, and their new lead. */
export const DEAL_LEAD_FIX: Record<string, { from: string; to: string }> = {
  'opp-h': { from: '', to: 'Mary Sbaschnig' },
  'opp-r': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-u': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-x': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-aa': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-ad': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-ag': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-aj': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
  'opp-am': { from: 'Alex Rivera', to: 'Mary Sbaschnig' },
  'opp-ap': { from: 'Alex Rivera', to: 'Dennis DiCapua' },
}

export function fixOpportunity(row: Opportunity): Opportunity {
  let next = row
  const stage = COMPLETED_STAGE_FIX[row.id]
  if (stage && row.status === 'Completed' && row.stage === stage) next = { ...next, stage: 'Closing' }
  const lead = DEAL_LEAD_FIX[row.id]
  if (lead && (row.dealLead ?? '') === lead.from) next = { ...next, dealLead: lead.to }
  return next
}

/** Returns the same array when nothing needed fixing. */
export function applyDataFixes(rows: Opportunity[]): Opportunity[] {
  let changed = false
  const out = rows.map((row) => {
    const fixed = fixOpportunity(row)
    if (fixed !== row) changed = true
    return fixed
  })
  return changed ? out : rows
}
