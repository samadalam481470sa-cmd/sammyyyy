import { useRef, useState } from 'react'
import { ExternalLink, FileSpreadsheet, Upload, X } from 'lucide-react'
import {
  parseSpreadsheet,
  rowToOpportunityDraft,
  type ImportDestination,
  type ImportRow,
} from '@/lib/excelImport'
import type { Opportunity } from '@/types'

interface ExcelImportModalProps {
  open: boolean
  onClose: () => void
  opportunities: Opportunity[]
  onCreateOpportunities: (drafts: Partial<Opportunity>[]) => Promise<void>
  onUpdateOpportunity: (id: string, patch: Partial<Opportunity>) => Promise<void>
  onImportTasks: (rows: ImportRow[]) => Promise<void>
  onImportContacts: (rows: ImportRow[]) => Promise<void>
}

type Step = 'source' | 'preview' | 'destination' | 'done'

export function ExcelImportModal({
  open,
  onClose,
  opportunities,
  onCreateOpportunities,
  onUpdateOpportunity,
  onImportTasks,
  onImportContacts,
}: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('source')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [destination, setDestination] = useState<ImportDestination>('new-opportunity')
  const [targetOppId, setTargetOppId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  if (!open) return null

  const reset = () => {
    setStep('source')
    setFileName(null)
    setRows([])
    setDestination('new-opportunity')
    setTargetOppId('')
    setError(null)
    setResultMsg(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const ingestFile = async (file: File) => {
    setError(null)
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseSpreadsheet(buf)
      if (parsed.rows.length === 0) {
        setError('No data rows found in that spreadsheet.')
        return
      }
      setFileName(file.name)
      setRows(parsed.rows)
      setStep('preview')
    } catch {
      setError('Could not read that file. Use .xlsx, .xls, or .csv.')
    }
  }

  const onConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      if (destination === 'new-opportunity') {
        const drafts = rows.map((r, i) => rowToOpportunityDraft(r, i))
        await onCreateOpportunities(drafts)
        setResultMsg(`Created ${drafts.length} new opportunit${drafts.length === 1 ? 'y' : 'ies'} from Excel.`)
      } else if (destination === 'update-opportunity') {
        if (!targetOppId) throw new Error('Choose an opportunity to paste into.')
        const draft = rowToOpportunityDraft(rows[0], 0)
        await onUpdateOpportunity(targetOppId, draft)
        setResultMsg(`Autofilled details into the selected opportunity from row 1.`)
      } else if (destination === 'tasks') {
        await onImportTasks(rows)
        setResultMsg(`Imported ${rows.length} task row(s).`)
      } else {
        await onImportContacts(rows)
        setResultMsg(`Imported ${rows.length} contact row(s).`)
      }
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-(--shadow-elevated)">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
            <div>
              <h2 className="font-brand text-lg font-semibold text-navy-900">Import Excel</h2>
              <p className="text-xs text-ink-muted">
                Upload a workbook or open Excel Online, then choose where to paste.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border p-2 text-ink-muted hover:bg-canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto px-5 py-4">
          {step === 'source' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-accent-muted bg-accent-soft/40 px-4 py-10 text-center transition hover:bg-accent-soft"
              >
                <Upload className="h-7 w-7 text-accent" />
                <span className="text-sm font-semibold text-navy-900">
                  Add file from this computer
                </span>
                <span className="text-xs text-ink-muted">.xlsx · .xls · .csv</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void ingestFile(f)
                }}
              />
              <a
                href="https://www.office.com/launch/excel"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-canvas px-4 py-3 text-sm font-semibold text-ink hover:bg-accent-soft"
              >
                <ExternalLink className="h-4 w-4 text-accent" />
                Open Excel on the web, then download / export and upload here
              </a>
              <p className="text-[11px] leading-relaxed text-ink-subtle">
                Tip: In Excel Online use File → Download a copy, then upload the .xlsx into this
                dialog. Column headers like Project Name, Entity, Status, Stage, NWP map
                automatically.
              </p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                Loaded <strong>{fileName}</strong> — {rows.length} row
                {rows.length === 1 ? '' : 's'}. Review, then choose a paste destination.
              </p>
              <div className="custom-scroll max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-canvas text-ink-subtle">
                    <tr>
                      {Object.keys(rows[0] ?? {})
                        .slice(0, 6)
                        .map((h) => (
                          <th key={h} className="px-2 py-1.5 font-semibold">
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.keys(rows[0] ?? {})
                          .slice(0, 6)
                          .map((h) => (
                            <td key={h} className="px-2 py-1.5 text-ink">
                              {String(r[h] ?? '')}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setStep('destination')}
                className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Choose where to paste
              </button>
            </div>
          )}

          {step === 'destination' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-navy-900">Paste destination</p>
              {(
                [
                  ['new-opportunity', 'Create new opportunities (autofill from each row)'],
                  ['update-opportunity', 'Autofill an existing opportunity (uses row 1)'],
                  ['tasks', 'Import as tasks / follow-ups'],
                  ['contacts', 'Import as relationships / contacts'],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    destination === id
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-canvas hover:bg-accent-soft/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="dest"
                    checked={destination === id}
                    onChange={() => setDestination(id)}
                    className="mt-1"
                  />
                  <span>{label}</span>
                </label>
              ))}

              {destination === 'update-opportunity' && (
                <select
                  value={targetOppId}
                  onChange={(e) => setTargetOppId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm"
                >
                  <option value="">Select opportunity…</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.projectName} — {o.entityName}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => void onConfirm()}
                className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
              >
                {busy ? 'Importing…' : 'Import now'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm font-medium text-emerald-800">{resultMsg}</p>
              <button
                type="button"
                onClick={handleClose}
                className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-attention-border bg-attention-bg px-3 py-2 text-sm text-attention">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
