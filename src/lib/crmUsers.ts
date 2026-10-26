import type { AuthUser } from '@/types'

export interface CrmUser {
  id: string
  name: string
}

/** Authorized deal/task owners. New signed-in users are appended, never invented from free text. */
export const BASE_CRM_USERS: CrmUser[] = [
  { id: 'user-mary', name: 'Mary Sbaschnig' },
  { id: 'user-dennis', name: 'Dennis DiCapua' },
]

export function crmUsersForSession(user: AuthUser | null | undefined): CrmUser[] {
  const list = BASE_CRM_USERS.map((row) => ({ ...row }))
  const name = user?.name?.trim()
  if (name && user && !list.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    list.push({ id: user.id, name })
  }
  return list
}

export function findCrmUserById(id: string | null | undefined, users: CrmUser[]): CrmUser | null {
  if (!id) return null
  return users.find((row) => row.id === id) ?? null
}

export function findCrmUserByName(name: string | null | undefined, users: CrmUser[]): CrmUser | null {
  const needle = name?.trim().toLowerCase()
  if (!needle) return null
  return users.find((row) => row.name.toLowerCase() === needle) ?? null
}
