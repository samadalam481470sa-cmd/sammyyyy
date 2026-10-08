export interface TeamMember {
  ownerKey: string
  slot: number | null
  name: string
  kind: 'slot' | 'manager'
}

export const TEAM_SLOT_MEMBERS: TeamMember[] = [
  { ownerKey: 'key:slot-1', slot: 1, name: 'Slot 1 — Primary integration', kind: 'slot' },
  { ownerKey: 'key:slot-2', slot: 2, name: 'Slot 2 — Reserved slot 2', kind: 'slot' },
  { ownerKey: 'key:slot-3', slot: 3, name: 'Slot 3 — Reserved slot 3', kind: 'slot' },
  { ownerKey: 'key:slot-4', slot: 4, name: 'Slot 4 — Reserved slot 4', kind: 'slot' },
  { ownerKey: 'key:slot-5', slot: 5, name: 'Slot 5 — Reserved slot 5', kind: 'slot' },
]

export const MANAGER_MEMBER: TeamMember = {
  ownerKey: 'key:manager',
  slot: null,
  name: 'Managerial master key',
  kind: 'manager',
}

export const ALL_TEAM_MEMBERS: TeamMember[] = [...TEAM_SLOT_MEMBERS, MANAGER_MEMBER]

export function memberByOwnerKey(ownerKey: string): TeamMember | undefined {
  return ALL_TEAM_MEMBERS.find((m) => m.ownerKey === ownerKey)
}

/** Non-manager keys always huddle with every partner slot (not the manager). */
export function defaultInvitees(isManager: boolean): string[] {
  if (isManager) return TEAM_SLOT_MEMBERS.map((m) => m.ownerKey)
  return TEAM_SLOT_MEMBERS.map((m) => m.ownerKey)
}
