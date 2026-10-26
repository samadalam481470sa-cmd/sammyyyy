import { describe, expect, it } from 'vitest'
import { defaultInvitees, MANAGER_MEMBER, TEAM_SLOT_MEMBERS } from '@/lib/teamRoster'

describe('teamRoster', () => {
  it('starts with every partner key selected so anyone can add or remove people', () => {
    expect(defaultInvitees()).toEqual(TEAM_SLOT_MEMBERS.map((m) => m.ownerKey))
    expect(defaultInvitees(false)).toEqual(defaultInvitees(true))
    expect(defaultInvitees()).not.toContain(MANAGER_MEMBER.ownerKey)
  })
})
