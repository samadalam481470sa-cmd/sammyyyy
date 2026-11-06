import { describe, expect, it } from 'vitest'
import { mergeRecord } from './recordMerge'

describe('mergeRecord', () => {
  const base = { id: '1', stage: 'A', notes: 'n', owner: 'x' }

  it('keeps both people\'s changes when they touched different fields', () => {
    const result = mergeRecord(base, { ...base, notes: 'mine' }, { ...base, stage: 'B' })
    expect(result.merged).toMatchObject({ stage: 'B', notes: 'mine' })
    expect(result.hasMine).toBe(true)
    expect(result.conflicts).toEqual([])
  })

  it('keeps the saved value and reports it when both changed one field', () => {
    const result = mergeRecord(base, { ...base, stage: 'Mine' }, { ...base, stage: 'Theirs' })
    expect(result.merged).toMatchObject({ stage: 'Theirs' })
    expect(result.conflicts).toEqual([{ field: 'stage', mine: 'Mine', theirs: 'Theirs' }])
    expect(result.hasMine).toBe(false)
  })

  it('does not call the same change a conflict', () => {
    expect(mergeRecord(base, { ...base, stage: 'B' }, { ...base, stage: 'B' }).conflicts).toEqual([])
  })

  it('ignores worked-out fields', () => {
    const result = mergeRecord({ ...base, updatedAt: '1' }, { ...base, updatedAt: '2', nextAction: 'x' }, { ...base, updatedAt: '3', nextAction: 'y' })
    expect(result.conflicts).toEqual([])
    expect(result.hasMine).toBe(false)
  })

  it('a record deleted on the server stays deleted, and an edit is reported', () => {
    const edited = mergeRecord(base, { ...base, stage: 'B' }, null)
    expect(edited.merged).toBeNull()
    expect(edited.deleteConflict).toBe('theirs-deleted')
    expect(mergeRecord(base, base, null).deleteConflict).toBeNull()
  })

  it('a delete does not remove what someone else just edited', () => {
    const result = mergeRecord(base, null, { ...base, stage: 'B' })
    expect(result.merged).toMatchObject({ stage: 'B' })
    expect(result.deleteConflict).toBe('mine-deleted')
  })

  it('a stale copy with no base changes nothing silently', () => {
    const result = mergeRecord(null, { id: '1', stage: 'Mine' }, { id: '1', stage: 'Theirs' })
    expect(result.merged).toMatchObject({ stage: 'Theirs' })
    expect(result.conflicts).toHaveLength(1)
  })
})
