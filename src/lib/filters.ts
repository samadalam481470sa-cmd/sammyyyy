import type { StageId, StatusId } from '../config/picklists'
import type { EnrichedOpportunity } from '../types'

/** Dashboard-wide filter state. Status, stage, search, and attention filters compose. */
export interface DashboardFilters {
  status: StatusId | 'all'
  stage: StageId | null
  search: string
  attentionOnly: boolean
}

export const DEFAULT_FILTERS: DashboardFilters = {
  status: 'all',
  stage: null,
  search: '',
  attentionOnly: false,
}

export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.status !== 'all' ||
    filters.stage !== null ||
    filters.search.trim() !== '' ||
    filters.attentionOnly
  )
}

interface ApplyOptions {
  /** Skip the stage filter (used by the pipeline, which visualizes all stages). */
  ignoreStage?: boolean
}

export function applyFilters(
  opportunities: EnrichedOpportunity[],
  filters: DashboardFilters,
  { ignoreStage = false }: ApplyOptions = {},
): EnrichedOpportunity[] {
  const query = filters.search.trim().toLowerCase()
  return opportunities.filter((opp) => {
    if (filters.status !== 'all' && opp.status !== filters.status) return false
    if (!ignoreStage && filters.stage !== null && opp.stage !== filters.stage) return false
    if (filters.attentionOnly && !opp.needsAttention) return false
    if (
      query &&
      !opp.projectName.toLowerCase().includes(query) &&
      !opp.entityName.toLowerCase().includes(query)
    ) {
      return false
    }
    return true
  })
}
