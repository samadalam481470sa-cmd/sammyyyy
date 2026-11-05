/**
 * Deal Leads: a deliberate roster of acquisition leads. It is separate from Microsoft sign-ins,
 * from Task Owners and from Relationships. Signing in never creates a lead.
 *
 * An opportunity has zero or one PRIMARY lead and any number of ADDITIONAL leads, stored as stable
 * lead ids. `opportunity.dealLead` stays as the primary's display name: older screens, exports and
 * reports keep reading it, so every report counts a deal once, under its primary lead.
 * A historical name that matches no roster record stays in `dealLead` as a legacy value to review.
 */
import type { AuthUser, Opportunity } from '@/types'

export const DEAL_LEADS_RESOURCE = 'dealLeads'
export const UNASSIGNED_LEAD = '__unassigned'
const LEGACY_PREFIX = 'legacy:'

export type DealLeadStatus = 'Active' | 'Inactive'

export interface DealLead {
  id: string
  name: string
  jobTitle: string
  /** Contact email shown on the card. Editing it never changes the Microsoft sign-in. */
  email: string
  phone: string
  status: DealLeadStatus
  /** Stable id of the Microsoft account linked to this record, when there is one. */
  authAccountId: string | null
  createdAt: string
  updatedAt: string
}

/** The two leads the CRM already assigns deals to. No contact details are invented for them. */
export const DEFAULT_DEAL_LEADS: DealLead[] = [
  { id: 'lead-mary', name: 'Mary Sbaschnig', jobTitle: '', email: '', phone: '', status: 'Active', authAccountId: null, createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z' },
  { id: 'lead-dennis', name: 'Dennis DiCapua', jobTitle: '', email: '', phone: '', status: 'Active', authAccountId: null, createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z' },
]

export type LeadFields = Pick<Opportunity, 'dealLead' | 'primaryLeadId' | 'additionalLeadIds'>

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

export function isValidLeadEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Fills the id fields on a record saved before the roster existed. An exact name match becomes the
 * primary; anything else stays as a legacy name, never dropped and never turned into a new lead.
 */
export function migrateOpportunityLeads<T extends Pick<Opportunity, 'dealLead'> & Partial<LeadFields>>(opportunity: T, roster: readonly DealLead[]): T {
  if (opportunity.primaryLeadId !== undefined && opportunity.additionalLeadIds !== undefined) return opportunity
  return { ...opportunity, primaryLeadId: opportunity.primaryLeadId ?? resolveLeadIdByName(opportunity.dealLead, roster), additionalLeadIds: opportunity.additionalLeadIds ?? [] }
}

/** Roster id for an exact name match; null when the name is empty or not on the roster. */
export function resolveLeadIdByName(name: string | null | undefined, roster: readonly DealLead[]): string | null {
  const wanted = norm(name)
  return wanted ? roster.find((lead) => norm(lead.name) === wanted)?.id ?? null : null
}

export function isLegacyLead(opportunity: Partial<LeadFields>): boolean {
  return !opportunity.primaryLeadId && Boolean(opportunity.dealLead?.trim())
}

/** Selector value for the primary lead: a lead id, a legacy name, or Unassigned. */
export function primaryLeadValue(opportunity: Partial<LeadFields>): string {
  if (opportunity.primaryLeadId) return opportunity.primaryLeadId
  return opportunity.dealLead?.trim() ? `${LEGACY_PREFIX}${opportunity.dealLead.trim()}` : UNASSIGNED_LEAD
}

/** The three stored fields for a chosen team. The primary can never also be an additional lead. */
export function leadAssignment(primaryValue: string | null, additionalIds: readonly string[], roster: readonly DealLead[]): LeadFields {
  const value = primaryValue ?? UNASSIGNED_LEAD
  const legacy = value.startsWith(LEGACY_PREFIX) ? value.slice(LEGACY_PREFIX.length) : null
  const primary = !legacy && value !== UNASSIGNED_LEAD ? roster.find((lead) => lead.id === value) ?? null : null
  return {
    primaryLeadId: primary?.id ?? null,
    additionalLeadIds: [...new Set(additionalIds)].filter((id) => id !== primary?.id),
    dealLead: primary?.name ?? legacy ?? '',
  }
}

export type LeadRole = 'primary' | 'additional'

export function leadRoleOn(opportunity: Partial<LeadFields>, leadId: string): LeadRole | null {
  if (opportunity.primaryLeadId === leadId) return 'primary'
  return opportunity.additionalLeadIds?.includes(leadId) ? 'additional' : null
}

export interface LeadLink<T> {
  opportunity: T
  role: LeadRole
}

/** A lead's linked opportunities, derived from the opportunities themselves, in Deal ID order. */
export function leadLinks<T extends Partial<LeadFields> & Pick<Opportunity, 'id'> & { projectNumber?: number }>(opportunities: readonly T[], leadId: string): LeadLink<T>[] {
  return opportunities
    .flatMap((opportunity) => {
      const role = leadRoleOn(opportunity, leadId)
      return role ? [{ opportunity, role }] : []
    })
    .sort((a, b) => (a.opportunity.projectNumber ?? 0) - (b.opportunity.projectNumber ?? 0))
}

export interface LinkChange {
  opportunityId: string
  patch: LeadFields
}

/**
 * Turns an edited project list on a lead into opportunity updates, the same relationship the
 * opportunity editor changes. A new link is additional, or primary when the deal has no primary or
 * legacy name. Removing the current primary needs a choice in `replacements` (a lead id or
 * UNASSIGNED_LEAD); a missing choice is reported in `needsReplacement` and nothing changes for it.
 */
export function leadLinkChanges<T extends Partial<LeadFields> & Pick<Opportunity, 'id'>>(
  opportunities: readonly T[],
  lead: DealLead,
  nextIds: readonly string[],
  replacements: Readonly<Record<string, string>>,
  roster: readonly DealLead[],
): { changes: LinkChange[]; needsReplacement: string[] } {
  const changes: LinkChange[] = []
  const needsReplacement: string[] = []
  const wanted = new Set(nextIds)
  for (const opportunity of opportunities) {
    const role = leadRoleOn(opportunity, lead.id)
    const additional = opportunity.additionalLeadIds ?? []
    if (wanted.has(opportunity.id) && !role) {
      const open = !opportunity.primaryLeadId && !opportunity.dealLead?.trim()
      changes.push({ opportunityId: opportunity.id, patch: open ? leadAssignment(lead.id, additional, roster) : leadAssignment(primaryLeadValue(opportunity), [...additional, lead.id], roster) })
    } else if (!wanted.has(opportunity.id) && role === 'additional') {
      changes.push({ opportunityId: opportunity.id, patch: leadAssignment(primaryLeadValue(opportunity), additional.filter((id) => id !== lead.id), roster) })
    } else if (!wanted.has(opportunity.id) && role === 'primary') {
      const replacement = replacements[opportunity.id]
      if (!replacement) needsReplacement.push(opportunity.id)
      else changes.push({ opportunityId: opportunity.id, patch: leadAssignment(replacement, additional, roster) })
    }
  }
  return { changes, needsReplacement }
}

/** Signed-in person's own record: the linked account only, so a changed contact email never orphans it. */
export function findOwnLead(leads: readonly DealLead[], user: Pick<AuthUser, 'id'> | null | undefined): DealLead | null {
  if (!user?.id) return null
  return leads.find((lead) => lead.authAccountId === user.id) ?? null
}

/**
 * An unlinked roster record that is clearly this person: same display name as the verified sign-in.
 * Adding yourself links it instead of creating a duplicate (Mary and Dennis start like this).
 */
export function claimableLead(leads: readonly DealLead[], user: Pick<AuthUser, 'id' | 'name'> | null | undefined): DealLead | null {
  if (!user?.name || findOwnLead(leads, user)) return null
  return leads.find((lead) => !lead.authAccountId && norm(lead.name) === norm(user.name)) ?? null
}

/** Another record already using this contact email. Stops someone claiming another person's identity. */
export function emailConflict(leads: readonly DealLead[], email: string, selfId: string | null): DealLead | null {
  const wanted = norm(email)
  return wanted ? leads.find((lead) => lead.id !== selfId && norm(lead.email) === wanted) ?? null : null
}

export interface LeadPermissions {
  /** Create or edit other people's records, change status and links to accounts. */
  admin: boolean
  isOwn: boolean
  canEditProfile: boolean
  canChangeStatus: boolean
}

/** These checks shape the screen only. They are not security: see docs/SPRINT_NOV_NEXT_FIXES.md. */
export function leadPermissions(lead: DealLead | null, user: Pick<AuthUser, 'id'> | null | undefined, admin: boolean): LeadPermissions {
  const isOwn = Boolean(lead && user?.id && lead.authAccountId === user.id)
  return { admin, isOwn, canEditProfile: admin || isOwn, canChangeStatus: admin }
}

/** Primary selector options: Active leads, plus the current value when it is inactive or legacy. */
export function primaryLeadOptions(roster: readonly DealLead[], current: Partial<LeadFields>) {
  const options = roster.filter((lead) => lead.status === 'Active' || lead.id === current.primaryLeadId).map((lead) => ({ id: lead.id, label: lead.name, detail: lead.status === 'Inactive' ? 'Inactive — historical assignment' : lead.jobTitle || undefined }))
  options.sort((a, b) => a.label.localeCompare(b.label))
  const legacy = isLegacyLead(current) ? [{ id: primaryLeadValue(current), label: current.dealLead!.trim(), detail: 'Not on the roster — review and reassign' }] : []
  return [{ id: UNASSIGNED_LEAD, label: 'Unassigned', detail: undefined as string | undefined }, ...legacy, ...options]
}

/** Additional selector options: Active leads other than the primary, plus inactive leads already on the team. */
export function additionalLeadOptions(roster: readonly DealLead[], current: Partial<LeadFields>) {
  return roster
    .filter((lead) => lead.id !== current.primaryLeadId && (lead.status === 'Active' || current.additionalLeadIds?.includes(lead.id)))
    .map((lead) => ({ id: lead.id, label: lead.name, detail: lead.status === 'Inactive' ? 'Inactive — historical assignment' : lead.jobTitle || undefined }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
