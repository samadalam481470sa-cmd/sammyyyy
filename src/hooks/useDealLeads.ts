import { useMemo } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useResource, type ResourceApi } from '@/hooks/useResource'
import { DEAL_LEADS_RESOURCE, DEFAULT_DEAL_LEADS, claimableLead, findOwnLead, type DealLead } from '@/lib/dealLeads'

export interface DealLeadsApi {
  api: ResourceApi<DealLead>
  leads: DealLead[]
  own: DealLead | null
  claimable: DealLead | null
}

export function useDealLeads(): DealLeadsApi {
  const { user } = useAuth()
  const api = useResource<DealLead>(DEAL_LEADS_RESOURCE, DEFAULT_DEAL_LEADS, { seedOnce: true })
  return useMemo(
    () => ({ api, leads: api.items, own: findOwnLead(api.items, user), claimable: claimableLead(api.items, user) }),
    [api, user],
  )
}
