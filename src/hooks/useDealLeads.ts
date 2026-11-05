import { useMemo } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useResource, type ResourceApi } from '@/hooks/useResource'
import { DEAL_LEADS_RESOURCE, DEFAULT_DEAL_LEADS, claimableLead, findOwnLead, type DealLead } from '@/lib/dealLeads'
import { useWorkspaceRole } from '@/lib/workspaceSync'

export interface DealLeadsApi {
  api: ResourceApi<DealLead>
  leads: DealLead[]
  /** Server-reported admin or the manager session. No role is ever invented in the browser. */
  isAdmin: boolean
  own: DealLead | null
  claimable: DealLead | null
}

export function useDealLeads(): DealLeadsApi {
  const { user } = useAuth()
  const api = useResource<DealLead>(DEAL_LEADS_RESOURCE, DEFAULT_DEAL_LEADS)
  const role = useWorkspaceRole()
  const isAdmin = Boolean(user?.isManager) || user?.role === 'admin' || role === 'admin'
  return useMemo(
    () => ({ api, leads: api.items, isAdmin, own: findOwnLead(api.items, user), claimable: claimableLead(api.items, user) }),
    [api, isAdmin, user],
  )
}
