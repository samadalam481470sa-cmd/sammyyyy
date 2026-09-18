export type Status = 'Prospect' | 'On Platform'

export type Financial = {
  year: number
  ebitda: number
}

export type MGA = {
  id: number
  name: string
  initials: string
  location: string
  region: 'Northeast' | 'Southeast' | 'Midwest' | 'West'
  experience: number
  status: Status
  stage: 'Initial review' | 'Management call' | 'Diligence' | 'LOI'
  ebitda: number
  growth: number
  lines: string[]
  coverages: string[]
  agencies: number
  financials: Financial[]
}

export const mgas: MGA[] = [
  {
    id: 1, name: 'Atlantic Specialty', initials: 'AS', location: 'Boston, MA',
    region: 'Northeast', experience: 28, status: 'On Platform', stage: 'LOI',
    ebitda: 12.4, growth: 18.6, lines: ['Professional Lines', 'Cyber'],
    coverages: ['E&O', 'Cyber Liability'], agencies: 42,
    financials: [{ year: 2022, ebitda: 8.1 }, { year: 2023, ebitda: 9.3 }, { year: 2024, ebitda: 10.5 }, { year: 2025, ebitda: 12.4 }],
  },
  {
    id: 2, name: 'Summit Underwriters', initials: 'SU', location: 'Denver, CO',
    region: 'West', experience: 24, status: 'On Platform', stage: 'LOI',
    ebitda: 9.8, growth: 14.2, lines: ['Property', 'Construction'],
    coverages: ['CAT Property', 'Builders Risk'], agencies: 36,
    financials: [{ year: 2022, ebitda: 7.2 }, { year: 2023, ebitda: 7.8 }, { year: 2024, ebitda: 8.6 }, { year: 2025, ebitda: 9.8 }],
  },
  {
    id: 3, name: 'HarborPoint Risk', initials: 'HR', location: 'Tampa, FL',
    region: 'Southeast', experience: 31, status: 'On Platform', stage: 'LOI',
    ebitda: 8.7, growth: 22.4, lines: ['Marine', 'Property'],
    coverages: ['Inland Marine', 'CAT Property'], agencies: 29,
    financials: [{ year: 2022, ebitda: 5.4 }, { year: 2023, ebitda: 6.1 }, { year: 2024, ebitda: 7.1 }, { year: 2025, ebitda: 8.7 }],
  },
  {
    id: 4, name: 'Northstar Programs', initials: 'NP', location: 'Chicago, IL',
    region: 'Midwest', experience: 21, status: 'On Platform', stage: 'LOI',
    ebitda: 7.1, growth: 11.8, lines: ['Transportation', 'Workers Comp'],
    coverages: ['Commercial Auto', 'Occupational Accident'], agencies: 33,
    financials: [{ year: 2022, ebitda: 5.5 }, { year: 2023, ebitda: 5.8 }, { year: 2024, ebitda: 6.4 }, { year: 2025, ebitda: 7.1 }],
  },
  {
    id: 5, name: 'Pinnacle Risk Partners', initials: 'PR', location: 'New York, NY',
    region: 'Northeast', experience: 26, status: 'Prospect', stage: 'Diligence',
    ebitda: 10.2, growth: 24.8, lines: ['Professional Lines', 'Healthcare'],
    coverages: ['E&O', 'Medical Malpractice'], agencies: 0,
    financials: [{ year: 2022, ebitda: 5.9 }, { year: 2023, ebitda: 6.8 }, { year: 2024, ebitda: 8.2 }, { year: 2025, ebitda: 10.2 }],
  },
  {
    id: 6, name: 'Cypress Specialty', initials: 'CS', location: 'Atlanta, GA',
    region: 'Southeast', experience: 19, status: 'Prospect', stage: 'Management call',
    ebitda: 6.6, growth: 20.1, lines: ['Cyber', 'Technology'],
    coverages: ['Cyber Liability', 'Tech E&O'], agencies: 0,
    financials: [{ year: 2022, ebitda: 4.0 }, { year: 2023, ebitda: 4.5 }, { year: 2024, ebitda: 5.5 }, { year: 2025, ebitda: 6.6 }],
  },
  {
    id: 7, name: 'Great Lakes MGA', initials: 'GL', location: 'Detroit, MI',
    region: 'Midwest', experience: 34, status: 'Prospect', stage: 'LOI',
    ebitda: 8.4, growth: 16.5, lines: ['Transportation', 'Construction'],
    coverages: ['Commercial Auto', 'Builders Risk'], agencies: 0,
    financials: [{ year: 2022, ebitda: 5.8 }, { year: 2023, ebitda: 6.3 }, { year: 2024, ebitda: 7.2 }, { year: 2025, ebitda: 8.4 }],
  },
  {
    id: 8, name: 'Pacific Crest Programs', initials: 'PC', location: 'San Diego, CA',
    region: 'West', experience: 17, status: 'Prospect', stage: 'Initial review',
    ebitda: 5.8, growth: 12.3, lines: ['Marine', 'Hospitality'],
    coverages: ['Inland Marine', 'General Liability'], agencies: 0,
    financials: [{ year: 2022, ebitda: 4.1 }, { year: 2023, ebitda: 4.5 }, { year: 2024, ebitda: 5.2 }, { year: 2025, ebitda: 5.8 }],
  },
]
