import { describe, expect, it } from 'vitest'
import type { PortableDatabase } from './portableDatabase'
import { compareImport } from './safeImport'

const empty = { opportunities: [], tasks: [], documents: [], contacts: [], dealLeads: [] }
const database = (rows: Partial<Record<string, unknown[]>>) => ({ schemaVersion: 1, exportedAt: '', activity: [], ...empty, ...rows }) as unknown as PortableDatabase

describe('compareImport', () => {
  it('sorts a file into new, same, changed and duplicate, and changes nothing', () => {
    const current = {
      ...empty,
      opportunities: [
        { id: 'a', projectName: 'Alpha', entityName: 'A Co', stage: 'One', updatedAt: '2026-01-01' },
        { id: 'b', projectName: 'Beta', entityName: 'B Co', stage: 'One', updatedAt: '2026-01-05' },
      ],
    }
    const snapshot = JSON.stringify(current)
    const preview = compareImport(
      database({
        opportunities: [
          { id: 'a', projectName: 'Alpha', entityName: 'A Co', stage: 'One', updatedAt: '2026-03-01' },
          { id: 'b', projectName: 'Beta', entityName: 'B Co', stage: 'Old', updatedAt: '2026-01-01' },
          { id: 'c', projectName: 'Gamma', entityName: 'G Co', stage: 'One' },
          { id: 'z', projectName: 'alpha ', entityName: 'A Co', stage: 'One' },
        ],
      }),
      current,
      'file.json',
    )
    expect(preview.counts).toEqual({ new: 1, same: 1, changed: 1, duplicate: 1 })
    expect(preview.rows.find((row) => row.id === 'b')).toMatchObject({ kind: 'changed', fileIsNewer: false })
    expect(JSON.stringify(current)).toBe(snapshot)
  })

  it('reads a backup with no deal leads and ignores a repeated id', () => {
    const preview = compareImport(database({ tasks: [{ id: 't', action: 'x' }, { id: 't', action: 'y' }], dealLeads: undefined }), empty, 'f')
    expect(preview.rows).toHaveLength(1)
  })
})
