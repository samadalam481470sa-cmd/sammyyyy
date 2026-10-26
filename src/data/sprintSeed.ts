import type { Opportunity } from '../types'
import { mockOpportunities } from './mockOpportunities'
import { anonymousProjectName } from '../lib/demoAliases'
import type { ContactRecord, TaskRecord } from './mockModules'

const TITLES = ['CEO', 'President', 'Managing Director', 'Attorney', 'Accountant', 'Consultant']
const CATEGORIES = [
  'Management',
  'Investment Banker',
  'Lawyer',
  'Accountant',
  'Consultant',
  'Broker',
  'Carrier Contact',
  'Financial Advisor',
]
const DUE = [
  '2026-10-20',
  '2026-10-26',
  '2026-10-29',
  '2026-11-02',
  '2026-11-09',
  '2026-12-01',
  '2027-01-15',
]

export function sprintCoverageContacts(): ContactRecord[] {
  return mockOpportunities.map((opp, index) => ({
    id: `rel-seed-${opp.id}`,
    name: `Alex ${opp.projectName.replace('Project ', '')}`,
    title: TITLES[index % TITLES.length],
    company: index % 4 === 0 ? 'Fictional Advisory LLP' : opp.entityName,
    category: CATEGORIES[index % CATEGORIES.length],
    email: `alex.${opp.id}@fictional-demo.test`,
    phone: '(555) 010-0100',
    opportunityId: opp.id,
    opportunityIds: [opp.id],
    projectName: opp.projectName,
    status: index % 11 === 0 ? 'Inactive' : 'Active',
    lastContactDate: '2026-10-12',
    notes: 'Fictional coverage contact. Not a live Newport relationship.',
  }))
}

export function sprintExtraTasks(): TaskRecord[] {
  return Array.from({ length: 24 }, (_, index) => {
    const opp = mockOpportunities[index % mockOpportunities.length]
    return {
      id: `task-sprint-${index + 1}`,
      priority: (['A', 'B', 'C'] as const)[index % 3],
      action: `Fictional follow-up ${index + 1} for ${opp.projectName}`,
      opportunityId: opp.id,
      projectName: opp.projectName || anonymousProjectName(opp.id),
      owner: opp.dealLead || 'Mary Sbaschnig',
      dueDate: DUE[index % DUE.length],
      status: index % 8 === 0 ? 'Done' : index % 5 === 0 ? 'In Progress' : 'Open',
      notes: 'Seeded sprint task. Not a live work item.',
      completedAt: index % 8 === 0 ? '2026-10-18T15:00:00Z' : null,
    }
  })
}

export function mergeMissingById<T extends { id: string }>(current: T[], extras: T[]): T[] {
  const seen = new Set(current.map((row) => row.id))
  const missing = extras.filter((row) => row.id && !seen.has(row.id))
  if (missing.length === 0) return current
  return [...current, ...missing]
}

export function coverOpportunities(contacts: ContactRecord[], opportunities: Opportunity[]): ContactRecord[] {
  const covered = new Set<string>()
  for (const contact of contacts) {
    if (contact.opportunityId) covered.add(contact.opportunityId)
    for (const id of contact.opportunityIds ?? []) covered.add(id)
  }
  const wanted = new Set(opportunities.map((opp) => opp.id))
  const missing = sprintCoverageContacts().filter(
    (contact) => contact.opportunityId && wanted.has(contact.opportunityId) && !covered.has(contact.opportunityId),
  )
  return mergeMissingById(contacts, missing)
}
