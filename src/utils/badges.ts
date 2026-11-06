import type { AcquisitionStage, OpportunityStatus } from '@/types'

/** Distinct color chips for opportunity status. */
export const STATUS_BADGE: Record<OpportunityStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  Pending: 'bg-sky-100 text-sky-800 border border-sky-200',
  Inactive: 'bg-slate-100 text-slate-600 border border-slate-200',
  Closed: 'bg-zinc-200 text-zinc-800 border border-zinc-300',
  Declined: 'bg-rose-100 text-rose-800 border border-rose-200',
  Withdrew: 'bg-orange-100 text-orange-800 border border-orange-200',
  Completed: 'bg-teal-100 text-teal-900 border border-teal-200',
}

/** Distinct color chips for acquisition stages (incl. NDA). */
export const STAGE_BADGE: Record<AcquisitionStage, string> = {
  'Target Identified': 'bg-slate-100 text-slate-700 border border-slate-200',
  'Initial Outreach': 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  'Preliminary Discussion': 'bg-violet-100 text-violet-800 border border-violet-200',
  NDA: 'bg-amber-100 text-amber-900 border border-amber-300',
  'Initial Review': 'bg-cyan-100 text-cyan-900 border border-cyan-200',
  'IOI / LOI': 'bg-blue-100 text-blue-900 border border-blue-200',
  Exclusivity: 'bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200',
  'Due Diligence': 'bg-orange-100 text-orange-900 border border-orange-200',
  Closing: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
}

/** Chart colors with the same meaning as the status badges: green, blue, teal, gray, muted red, muted amber, dark neutral. */
export const STATUS_CHART_COLORS: Record<string, string> = {
  Active: '#3f9d6b',
  Pending: '#4a90c9',
  Completed: '#2a9d8f',
  Inactive: '#a3adbd',
  Declined: '#c0675c',
  Withdrew: '#d2a058',
  Closed: '#5a6577',
}

export function statusBadge(status: string): string {
  return (
    STATUS_BADGE[status as OpportunityStatus] ??
    'bg-canvas text-ink-muted border border-border'
  )
}

export function stageBadge(stage: string): string {
  return (
    STAGE_BADGE[stage as AcquisitionStage] ??
    'bg-canvas text-ink-muted border border-border'
  )
}

export function badgeClass(extra = ''): string {
  return `inline-block w-fit max-w-full truncate rounded-md px-2 py-0.5 align-middle text-[11px] leading-4 font-semibold tracking-wide whitespace-nowrap ${extra}`
}
