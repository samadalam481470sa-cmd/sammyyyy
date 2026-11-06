import { useMemo, useState } from 'react'
import { useData } from '@/data/DataContext'
import { IMPORT_COLLECTIONS, type ImportPreview, type ImportResult } from '@/lib/safeImport'

const LABEL: Record<string, string> = { opportunities: 'Opportunities', tasks: 'Tasks', documents: 'Documents', contacts: 'Relationships', dealLeads: 'Deal Leads' }

/**
 * The only way a backup file reaches live records. It shows what the file holds against what is
 * saved now, nothing happens until Import, and nothing is ever deleted by it.
 */
export function ImportReview({ preview, shared, onClose, onDone }: { preview: ImportPreview; shared: boolean; onClose: () => void; onDone: (result: ImportResult) => void }) {
  const { applyImport } = useData()
  const [includeChanged, setIncludeChanged] = useState(false)
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { counts } = preview
  const table = useMemo(
    () =>
      IMPORT_COLLECTIONS.map((collection) => {
        const rows = preview.rows.filter((row) => row.collection === collection)
        return { collection, new: rows.filter((r) => r.kind === 'new').length, same: rows.filter((r) => r.kind === 'same').length, changed: rows.filter((r) => r.kind === 'changed').length, duplicate: rows.filter((r) => r.kind === 'duplicate').length }
      }).filter((row) => row.new + row.same + row.changed + row.duplicate > 0),
    [preview],
  )
  const total = counts.new + (includeChanged ? counts.changed : 0) + (includeDuplicates ? counts.duplicate : 0)
  const run = () => {
    setBusy(true)
    setError(null)
    void applyImport(preview, { includeChanged, includeDuplicates })
      .then(onDone)
      .catch((err: unknown) => setError(err instanceof Error ? `Nothing further was imported. ${err.message}` : 'The import did not finish.'))
      .finally(() => setBusy(false))
  }
  const cell = 'px-2.5 py-1.5 text-right tabular-nums'
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" data-testid="import-review">
      <button type="button" className="absolute inset-0 bg-navy-950/45" aria-label="Close import review" onClick={() => !busy && onClose()} />
      <div className="relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-5" role="dialog" aria-modal="true" aria-label="Review import">
        <h3 className="font-brand text-xl font-bold text-navy-900">Review this import</h3>
        <p className="mt-1 truncate text-sm text-ink-muted" title={preview.fileName}>{preview.fileName}</p>
        <p className="mt-3 rounded-lg border border-[#f0e2bd] bg-[#fdf7e7] px-3 py-2 text-xs text-[#7a5c1e]">
          {shared ? 'This adds records to the live database that everyone at Newport uses.' : 'This adds records to this browser.'} It never deletes anything, and a record someone deleted on purpose stays deleted.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs" data-testid="import-counts">
            <thead className="bg-canvas text-[10px] tracking-[0.06em] text-ink-subtle uppercase">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Records</th>
                <th className={`${cell} font-semibold`}>New</th>
                <th className={`${cell} font-semibold`}>Identical</th>
                <th className={`${cell} font-semibold`}>Different</th>
                <th className={`${cell} font-semibold`}>Possible duplicate</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.collection} className="border-t border-border">
                  <td className="px-2.5 py-1.5 font-medium text-ink">{LABEL[row.collection]}</td>
                  <td className={cell}>{row.new}</td>
                  <td className={cell}>{row.same}</td>
                  <td className={cell}>{row.changed}</td>
                  <td className={cell}>{row.duplicate}</td>
                </tr>
              ))}
              {table.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2.5 py-3 text-ink-muted">This file has no records.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink">New records are added. Identical ones are skipped.</p>
        {counts.changed > 0 && (
          <label className="mt-2 flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5" data-testid="import-include-changed" checked={includeChanged} onChange={(e) => setIncludeChanged(e.target.checked)} />
            <span>
              Also replace {counts.changed} saved record{counts.changed === 1 ? '' : 's'} with the file's copy.
              <span className="block text-xs text-ink-muted">Off by default. The current copy is overwritten, including newer edits by other people. {preview.rows.filter((r) => r.kind === 'changed' && r.fileIsNewer).length} of these look newer in the file.</span>
            </span>
          </label>
        )}
        {counts.duplicate > 0 && (
          <label className="mt-2 flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5" data-testid="import-include-duplicates" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} />
            <span>
              Add {counts.duplicate} possible duplicate{counts.duplicate === 1 ? '' : 's'} anyway.
              <span className="block text-xs text-ink-muted">Same name as a saved record, but a different id. Left out by default.</span>
            </span>
          </label>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-attention">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-ink hover:bg-canvas">Cancel</button>
          <button type="button" data-testid="import-apply" disabled={busy || total === 0} onClick={run} className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Importing…' : `Import ${total} record${total === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
