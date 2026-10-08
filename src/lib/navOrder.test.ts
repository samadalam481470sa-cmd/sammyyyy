import { describe, expect, it } from 'vitest'
import { applyNavOrder, mergeNavOrderWithDefaults, moveNavId } from './navOrder'
import type { NavItem } from '@/data/constants'

const sample: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', enabled: true },
  { id: 'opportunities', label: 'Opportunities', path: '/opportunities', enabled: true },
  { id: 'projects', label: 'Projects', path: '/projects', enabled: true },
  { id: 'reports', label: 'Reports', path: '/reports', enabled: true },
]

describe('navOrder', () => {
  it('applies saved order and inserts missing items before the next default neighbor', () => {
    const ordered = applyNavOrder(sample, ['reports', 'dashboard', 'opportunities'])
    expect(ordered.map((i) => i.id)).toEqual([
      'projects',
      'reports',
      'dashboard',
      'opportunities',
    ])
  })

  it('moves an id within the list', () => {
    const ids = sample.map((i) => i.id)
    expect(moveNavId(ids, 0, 2)).toEqual([
      'opportunities',
      'projects',
      'dashboard',
      'reports',
    ])
  })

  it('ignores bad move indexes', () => {
    const ids = sample.map((i) => i.id)
    expect(moveNavId(ids, 0, 0)).toEqual(ids)
    expect(moveNavId(ids, -1, 2)).toEqual(ids)
  })

  it('inserts newly added ids before the next known default neighbor', () => {
    const defaults = ['dashboard', 'reports', 'meetings', 'security']
    const saved = ['reports', 'dashboard', 'security']
    expect(mergeNavOrderWithDefaults(defaults, saved)).toEqual([
      'reports',
      'dashboard',
      'meetings',
      'security',
    ])
  })
})
