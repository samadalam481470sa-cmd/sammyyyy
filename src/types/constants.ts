import { OpportunityStatus, OpportunityStage, OpportunityType, SourceType } from './crm'

export const ACQUISITION_STAGES: readonly OpportunityStage[] = [
  'Target Identified',
  'Initial Outreach',
  'Preliminary Discussion',
  'NDA',
  'Initial Review',
  'IOI / LOI',
  'Exclusivity',
  'Due Diligence',
  'Closing'
] as const

export const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  'Active',
  'Pending',
  'Inactive',
  'Closed',
  'Declined',
  'Withdrew',
  'Completed'
] as const

export const OPPORTUNITY_TYPES: readonly OpportunityType[] = [
  'Platform Acquisition',
  'Add-on Acquisition',
  'Organic Growth Initiative',
  'Carrier Capacity'
] as const

export const SOURCE_TYPES: readonly SourceType[] = [
  'Investment Banker',
  'Intermediary',
  'Direct MGA Relationship',
  'Carrier Partner',
  'Other'
] as const

export const PRIORITY_CONFIG = {
  A: {
    label: 'Must move this week',
    shortLabel: 'Priority A',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-500/10',
    dotClass: 'bg-rose-500'
  },
  B: {
    label: 'Important but can wait',
    shortLabel: 'Priority B',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-500/10',
    dotClass: 'bg-amber-500'
  },
  C: {
    label: 'Monitor only',
    shortLabel: 'Priority C',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200 ring-1 ring-slate-400/10',
    dotClass: 'bg-slate-400'
  }
} as const

export const STATUS_CONFIG: Record<OpportunityStatus, { label: string; badgeClass: string; dotClass: string }> = {
  Active: {
    label: 'Active',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10',
    dotClass: 'bg-emerald-500'
  },
  Pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-600/10',
    dotClass: 'bg-amber-500'
  },
  Inactive: {
    label: 'Inactive',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 ring-1 ring-slate-400/10',
    dotClass: 'bg-slate-400'
  },
  Closed: {
    label: 'Closed',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-600/10',
    dotClass: 'bg-blue-500'
  },
  Declined: {
    label: 'Declined',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-600/10',
    dotClass: 'bg-rose-400'
  },
  Withdrew: {
    label: 'Withdrew',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-600/10',
    dotClass: 'bg-purple-400'
  },
  Completed: {
    label: 'Completed',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 ring-1 ring-teal-600/10',
    dotClass: 'bg-teal-500'
  }
}

export const STAGE_CONFIG: Record<OpportunityStage, { index: number; shortName: string; color: string }> = {
  'Target Identified': { index: 1, shortName: 'Target ID', color: '#94A3B8' },
  'Initial Outreach': { index: 2, shortName: 'Outreach', color: '#64748B' },
  'Preliminary Discussion': { index: 3, shortName: 'Prelim Disc.', color: '#0284C7' },
  'NDA': { index: 4, shortName: 'NDA', color: '#2563EB' },
  'Initial Review': { index: 5, shortName: 'Review', color: '#4F46E5' },
  'IOI / LOI': { index: 6, shortName: 'IOI / LOI', color: '#7C3AED' },
  'Exclusivity': { index: 7, shortName: 'Exclusivity', color: '#9333EA' },
  'Due Diligence': { index: 8, shortName: 'Diligence', color: '#C026D3' },
  'Closing': { index: 9, shortName: 'Closing', color: '#059669' }
}
