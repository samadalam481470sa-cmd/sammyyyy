import { describe, expect, it } from 'vitest'
import { defaultInvitees, MANAGER_MEMBER, TEAM_SLOT_MEMBERS } from '@/lib/teamRoster'

describe('teamRoster', () => {
  it('auto-includes every partner key and never the manager', () => {
    const invitees = defaultInvitees(false)
    expect(invitees).toEqual(TEAM_SLOT_MEMBERS.map((m) => m.ownerKey))
    expect(invitees).not.toContain(MANAGER_MEMBER.ownerKey)
    expect(defaultInvitees(true)).not.toContain(MANAGER_MEMBER.ownerKey)
  })
})
