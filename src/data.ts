export type Status = 'Acquired' | 'Prospect'
export type Stage = 'On Platform' | 'Diligence' | 'Management Meeting' | 'Initial Review'

export interface Financial {
  year: number
  ebitda: number
}

export interface MGA {
  id: number
  name: string
  initials: string
  status: Status
  stage: Stage
  experience: number
  founded: number
  headquarters: string
  regions: string[]
  lines: string[]
  coverages: string[]
  financials: Financial[]
  agencies: number
  accent: string
}

export const mgas: MGA[] = [
  {
    id: 1,
    name: 'HarborPoint Underwriters',
    initials: 'HU',
    status: 'Acquired',
    stage: 'On Platform',
    experience: 28,
    founded: 1998,
    headquarters: 'Boston, MA',
    regions: ['Northeast', 'Mid-Atlantic'],
    lines: ['Professional Liability', 'Cyber'],
    coverages: ['E&O', 'Cyber Liability'],
    financials: [{ year: 2022, ebitda: 8.4 }, { year: 2023, ebitda: 9.6 }, { year: 2024, ebitda: 11.2 }],
    agencies: 42,
    accent: '#2D7183',
  },
  {
    id: 2,
    name: 'Summit Risk Partners',
    initials: 'SR',
    status: 'Acquired',
    stage: 'On Platform',
    experience: 31,
    founded: 1995,
    headquarters: 'Denver, CO',
    regions: ['Mountain West', 'Southwest'],
    lines: ['Commercial Property', 'Construction'],
    coverages: ['Property', 'General Liability'],
    financials: [{ year: 2022, ebitda: 10.1 }, { year: 2023, ebitda: 11.4 }, { year: 2024, ebitda: 13.7 }],
    agencies: 56,
    accent: '#B78955',
  },
  {
    id: 3,
    name: 'Coastal Specialty Group',
    initials: 'CS',
    status: 'Acquired',
    stage: 'On Platform',
    experience: 24,
    founded: 2002,
    headquarters: 'Charleston, SC',
    regions: ['Southeast', 'Gulf Coast'],
    lines: ['Marine', 'Commercial Property'],
    coverages: ['Marine Cargo', 'CAT Property'],
    financials: [{ year: 2022, ebitda: 6.8 }, { year: 2023, ebitda: 8.1 }, { year: 2024, ebitda: 9.9 }],
    agencies: 37,
    accent: '#758C81',
  },
  {
    id: 4,
    name: 'Pioneer Casualty Solutions',
    initials: 'PC',
    status: 'Acquired',
    stage: 'On Platform',
    experience: 22,
    founded: 2004,
    headquarters: 'Chicago, IL',
    regions: ['Midwest', 'Great Lakes'],
    lines: ['Workers’ Compensation', 'Transportation'],
    coverages: ['Workers’ Comp', 'Commercial Auto'],
    financials: [{ year: 2022, ebitda: 7.2 }, { year: 2023, ebitda: 8.5 }, { year: 2024, ebitda: 10.4 }],
    agencies: 48,
    accent: '#866F57',
  },
  {
    id: 5,
    name: 'Apex Program Administrators',
    initials: 'AP',
    status: 'Prospect',
    stage: 'Diligence',
    experience: 27,
    founded: 1999,
    headquarters: 'Dallas, TX',
    regions: ['Southwest', 'Gulf Coast'],
    lines: ['Construction', 'Transportation'],
    coverages: ['General Liability', 'Commercial Auto'],
    financials: [{ year: 2022, ebitda: 5.9 }, { year: 2023, ebitda: 7.2 }, { year: 2024, ebitda: 9.1 }],
    agencies: 34,
    accent: '#866F57',
  },
  {
    id: 6,
    name: 'Evergreen Specialty Markets',
    initials: 'ES',
    status: 'Prospect',
    stage: 'Management Meeting',
    experience: 19,
    founded: 2007,
    headquarters: 'Portland, OR',
    regions: ['Pacific Northwest', 'West Coast'],
    lines: ['Environmental', 'Professional Liability'],
    coverages: ['Pollution', 'E&O'],
    financials: [{ year: 2022, ebitda: 4.7 }, { year: 2023, ebitda: 5.8 }, { year: 2024, ebitda: 7.0 }],
    agencies: 28,
    accent: '#758C81',
  },
  {
    id: 7,
    name: 'Ironwood Insurance Programs',
    initials: 'II',
    status: 'Prospect',
    stage: 'Initial Review',
    experience: 35,
    founded: 1991,
    headquarters: 'Philadelphia, PA',
    regions: ['Mid-Atlantic', 'Northeast'],
    lines: ['Cyber', 'Healthcare'],
    coverages: ['Cyber Liability', 'Medical Malpractice'],
    financials: [{ year: 2022, ebitda: 8.2 }, { year: 2023, ebitda: 9.1 }, { year: 2024, ebitda: 10.8 }],
    agencies: 45,
    accent: '#2D7183',
  },
]

export const latestEbitda = (mga: MGA) => mgaLatest(mga).ebitda
const mgaLatest = (mga: MGA) => mga.financials[mga.financials.length - 1]

export const growth = (mga: MGA) => {
  const current = mgaLatest(mga).ebitda
  const previous = mga.financials[mga.financials.length - 2].ebitda
  return ((current - previous) / previous) * 100
}

export const portfolio = mgas.filter((mga) => mga.status === 'Acquired')
export const prospects = mgas.filter((mga) => mga.status === 'Prospect')

export const formatMoney = (value: number) => `$${value.toFixed(1)}M`
