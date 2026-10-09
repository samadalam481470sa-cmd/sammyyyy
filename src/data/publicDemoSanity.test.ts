import { describe, expect, it } from 'vitest'
import { mockOpportunities } from '@/data/mockOpportunities'
import {
  mockCarriers,
  mockContacts,
  mockDocuments,
  mockPortfolio,
  mockSources,
  mockTasksDb,
} from '@/data/mockModules'
import { mockActivity, mockAlerts, mockPriorityTasks } from '@/data/mockTasks'
import { mockMeetings } from '@/data/mockMeetings'
import {
  anonymousEntityName,
  anonymousProjectName,
  DEMO_SEED_OPPORTUNITY_IDS,
  letterCodeForOpportunityId,
} from '@/lib/demoAliases'

describe('public demo sanitization', () => {
  it('assigns matching Project / Entity letters from stable ids', () => {
    expect(mockOpportunities.map((o) => o.id)).toEqual([...DEMO_SEED_OPPORTUNITY_IDS])
    const shuffled = [...mockOpportunities].sort((a, b) => a.nwp - b.nwp)
    for (const row of shuffled) {
      const code = letterCodeForOpportunityId(row.id)
      expect(row.projectName).toBe(`Project ${code}`)
      expect(row.entityName).toBe(`Entity ${code}`)
      expect(anonymousProjectName(row.id)).toBe(row.projectName)
      expect(anonymousEntityName(row.id)).toBe(row.entityName)
    }
  })

  it('keeps only anonymous project/entity labels in seed records', () => {
    for (const row of mockOpportunities) {
      expect(row.projectName).toMatch(/^Project [A-P]$/)
      expect(row.entityName).toMatch(/^Entity [A-P]$/)
    }
    const blob = JSON.stringify([
      mockOpportunities,
      mockContacts,
      mockTasksDb,
      mockSources,
      mockCarriers,
      mockPortfolio,
      mockDocuments,
      mockPriorityTasks,
      mockActivity,
      mockAlerts,
      mockMeetings,
    ])
    expect(blob).toMatch(/Project A/)
    expect(blob).toMatch(/Entity B/)
    expect(blob.includes('opp-a')).toBe(true)
    expect(/Project [A-Z][a-z]{3,}/.test(blob)).toBe(false)
  })
})
