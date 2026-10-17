import type { AcquisitionStage, OpportunityStatus } from '@/types'

/**
 * Configurable acquisition stages.
 * Preliminary — may change after sponsor feedback.
 * Keep stage labels centralized; do not scatter hard-coded strings.
 */
export const ACQUISITION_STAGES: readonly AcquisitionStage[] = [
  'Target Identified',
  'Initial Outreach',
  'Preliminary Discussion',
  'NDA',
  'Initial Review',
  'IOI / LOI',
  'Exclusivity',
  'Due Diligence',
  'Closing',
] as const

export const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  'Active',
  'Pending',
  'Inactive',
  'Closed',
  'Declined',
  'Withdrew',
  'Completed',
] as const

export const STATUS_FILTER_OPTIONS = [
  'All Deals',
  ...OPPORTUNITY_STATUSES,
] as const

export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number]

/** Visible Dashboard status chips. Other statuses remain in records and Opportunities. */
export const DASHBOARD_STATUS_FILTERS = ['All Deals', 'Active', 'Pending', 'Completed'] as const

export type DashboardStatusFilter = (typeof DASHBOARD_STATUS_FILTERS)[number]

/** Dashboard All Deals = these three statuses only. Full taxonomy stays on Opportunities. */
export const DASHBOARD_FOCUS_STATUSES: readonly OpportunityStatus[] = [
  'Active',
  'Pending',
  'Completed',
] as const

export function isDashboardFocusStatus(status: OpportunityStatus): boolean {
  return (DASHBOARD_FOCUS_STATUSES as readonly string[]).includes(status)
}

export const OPPORTUNITY_TYPES = [
  'Platform Acquisition',
  'Add-on Acquisition',
  'Organic Growth Initiative',
  'Carrier Capacity',
] as const

export const SOURCE_TYPES = [
  'Investment Banker',
  'Intermediary',
  'Direct MGA Relationship',
  'Carrier Partner',
  'Other',
] as const

export interface NavItem {
  id: string
  label: string
  path: string
  enabled: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', enabled: true },
  { id: 'opportunities', label: 'Opportunities', path: '/opportunities', enabled: true },
  { id: 'relationships', label: 'Relationships', path: '/relationships', enabled: true },
  { id: 'tasks', label: 'Tasks & Follow-Ups', path: '/tasks', enabled: true },
  { id: 'sources', label: 'Sources / Bankers', path: '/sources', enabled: true },
  { id: 'carriers', label: 'Carriers / Reinsurers', path: '/carriers', enabled: true },
  { id: 'documents', label: 'Documents', path: '/documents', enabled: true },
  { id: 'reports', label: 'Reports', path: '/reports', enabled: true },
  { id: 'meetings', label: 'Meetings', path: '/meetings', enabled: true },
  { id: 'security', label: 'Security', path: '/security', enabled: true },
  { id: 'key-control', label: 'Boot Keys', path: '/security/keys', enabled: true },
  { id: 'key-provision', label: 'Provision Keys', path: '/security/provision', enabled: true },
]

export const CURRENT_USER = {
  name: 'Mary Sbaschnig',
  firstName: 'Mary',
  role: 'Managing Partner',
  initials: 'MS',
}

/** Demo disclaimer — all financial figures are fictional. */
export const DEMO_DISCLAIMER =
  'Demo data for illustration only. Financial figures are fictional and do not represent actual Newport data.'
