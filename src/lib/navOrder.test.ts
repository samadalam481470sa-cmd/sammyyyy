import { describe, expect, it } from 'vitest'
import { applyNavOrder, mergeNavOrderWithDefaults, moveNavId } from './navOrder'
import type { NavItem } from '@/data/constants'

const sample: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', enabled: true },
  { id: 'opportunities', label: 'Opportunities', path: '/opportunities', enabled: true },
  { id: 'projects', label: 'Projects', path: '/projects', enabled: true },
  { id: 'reports', label: 'Reports', path: '/reports', enabled: true },
  { id: 'meetings', label: 'Meetings', path: '/meetings', enabled: true },
  { id: 'security', label: 'Security', path: '/security', enabled: true },
]

describe('navOrder', () => {
  it('uses defaults when saved order does not start with dashboard', () => {
    const defaults = sample.map((i) => i.id)
    const saved = ['meetings', 'security', 'dashboard', 'opportunities']
    expect(mergeNavOrderWithDefaults(defaults, saved)).toEqual(defaults)
  })

  it('keeps dashboard first when applying a valid saved order', () => {
    const ordered = applyNavOrder(sample, [
      'dashboard',
      'reports',
      'opportunities',
      'projects',
      'security',
    ])
    expect(ordered.map((i) => i.id)[0]).toBe('dashboard')
    expect(ordered.map((i) => i.id)).toContain('meetings')
  })

  it('moves an id within the list but pins dashboard at top', () => {
    const ids = sample.map((i) => i.id)
    const moved = moveNavId(ids, 0, 2)
    expect(moved[0]).toBe('dashboard')
  })

  it('inserts newly added ids before the next known default neighbor', () => {
    const defaults = ['dashboard', 'reports', 'meetings', 'security']
    const saved = ['dashboard', 'reports', 'security']
    expect(mergeNavOrderWithDefaults(defaults, saved)).toEqual([
      'dashboard',
      'reports',
      'meetings',
      'security',
    ])
  })
})
