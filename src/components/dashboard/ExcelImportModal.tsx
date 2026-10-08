import { useRef, useState } from 'react'
import { ClipboardPaste, ExternalLink, FileSpreadsheet, Upload, X } from 'lucide-react'
import {
  describeMapping,
  parseClipboardText,
  parseSpreadsheet,
  rowToOpportunityDraft,
  type ImportDestination,
  type ImportRow,
  type SpreadsheetAnalysis,
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
  const [analysis, setAnalysis] = useState<SpreadsheetAnalysis | null>(null)
  const [destination, setDestination] = useState<ImportDestination>('new-opportunity')
  const [targetOppId, setTargetOppId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  if (!open) return null

  const rows = analysis?.rows ?? []
  const mapping = analysis ? describeMapping(analysis) : null
  const previewDraft =
    rows[0] != null ? rowToOpportunityDraft(rows[0], 0, { onlyMapped: true }) : null

  const reset = () => {
    setStep('source')
    setFileName(null)
    setAnalysis(null)
    setDestination('new-opportunity')
    setTargetOppId('')
    setError(null)
    setResultMsg(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const applyAnalysis = (parsed: SpreadsheetAnalysis, name: string) => {
    if (parsed.rows.length === 0) {
      setError('No data rows found in that spreadsheet.')
      return
    }
    setFileName(name)
    setAnalysis(parsed)
    setStep('preview')
  }

  const ingestFile = async (file: File) => {
    setError(null)
    try {
      const buf = await file.arrayBuffer()
      applyAnalysis(parseSpreadsheet(buf), file.name)
    } catch {
      setError('Could not read that file. Use .xlsx, .xls, or .csv.')
    }
  }

  const ingestClipboard = async () => {
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setError('Clipboard is empty. Copy cells from Excel first, then paste here.')
        return
      }
      applyAnalysis(parseClipboardText(text), 'Clipboard paste')
    } catch {
      setError('Could not read clipboard. Allow paste permission, or upload a file instead.')
    }
  }

  const onConfirm = async () => {
    if (!analysis) return
    setBusy(true)
    setError(null)
    try {
      if (destination === 'new-opportunity') {
        const drafts = analysis.rows.map((r, i) => rowToOpportunityDraft(r, i, { onlyMapped: false }))
        await onCreateOpportunities(drafts)
        const unmatchedNote =
          analysis.unmatchedHeaders.length > 0
            ? ` ${analysis.unmatchedHeaders.length} column(s) could not be matched (shown in red) and were skipped.`
            : ''
        setResultMsg(
          `Created ${drafts.length} opportunit${drafts.length === 1 ? 'y' : 'ies'} from Excel.${unmatchedNote}`,
        )
      } else if (destination === 'update-opportunity') {
        if (!targetOppId) throw new Error('Choose an opportunity to paste into.')
        const draft = rowToOpportunityDraft(analysis.rows[0], 0, { onlyMapped: true })
        if (Object.keys(draft).length === 0) {
          throw new Error('No matched columns to autofill. Fix headers or map the sheet and try again.')
        }
        await onUpdateOpportunity(targetOppId, draft)
        setResultMsg(
          `Autofilled ${Object.keys(draft).length} matched field(s) into the opportunity.` +
            (analysis.unmatchedHeaders.length
              ? ` Unmatched columns stay highlighted in red and were not written.`
              : ''),
        )
      } else if (destination === 'tasks') {
        await onImportTasks(analysis.rows)
        setResultMsg(`Imported ${analysis.rows.length} task row(s).`)
      } else {
        await onImportContacts(analysis.rows)
        setResultMsg(`Imported ${analysis.rows.length} contact row(s).`)
      }
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const formatPreviewValue = (key: string, value: unknown) => {
    if (value == null || value === '') return '—'
    if (typeof value === 'number') {
      if (['nwp', 'netRevenue', 'pfEbitda'].includes(key)) {
        return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      }
      return String(value)
    }
    return String(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-(--shadow-elevated)">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
            <div>
              <h2 className="font-brand text-lg font-semibold text-navy-900">Import Excel</h2>
              <p className="text-xs text-ink-muted">
                Upload or paste a sheet — we map columns into CRM fields and flag anything unknown in
                red.
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
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-accent-muted bg-accent-soft/40 px-4 py-8 text-center transition hover:bg-accent-soft"
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
              <button
                type="button"
                onClick={() => void ingestClipboard()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-canvas px-4 py-3 text-sm font-semibold text-ink hover:bg-accent-soft"
              >
                <ClipboardPaste className="h-4 w-4 text-accent" />
                Paste from Excel clipboard
              </button>
              <a
                href="https://www.office.com/launch/excel"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-canvas px-4 py-3 text-sm font-semibold text-ink hover:bg-accent-soft"
              >
                <ExternalLink className="h-4 w-4 text-accent" />
                Open Excel on the web
              </a>
              <p className="text-[11px] leading-relaxed text-ink-subtle">
                Headers like Project Name, Entity, Status, Stage, NWP, Net Revenue, PF EBITDA map into
                matching CRM elements. Unknown columns stay red so you can rename them in Excel.
              </p>
            </div>
          )}

          {step === 'preview' && analysis && mapping && (
            <div className="space-y-4">
              <p className="text-sm text-ink">
                Analyzed <strong>{fileName}</strong> — {rows.length} row
                {rows.length === 1 ? '' : 's'}. Matched columns fill CRM fields; unmatched stay red.
              </p>

              <div>
                <h3 className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
                  Column → CRM mapping
                </h3>
                <div className="mt-2 custom-scroll max-h-48 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-ink-subtle">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Excel column</th>
                        <th className="px-2 py-1.5 font-semibold">Maps to</th>
                        <th className="px-2 py-1.5 font-semibold">Sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.columns.map((col) => (
                        <tr
                          key={col.rawHeader}
                          className={`border-t border-border ${
                            col.matched ? '' : 'bg-rose-50 text-rose-800'
                          }`}
                        >
                          <td className="px-2 py-1.5 font-medium">{col.rawHeader}</td>
                          <td className="px-2 py-1.5">
                            {col.matched ? (
                              <span className="font-semibold text-success">{col.label}</span>
                            ) : (
                              <span className="font-semibold text-rose-700">Unmatched — not imported</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-ink-muted">{col.sample || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {previewDraft && Object.keys(previewDraft).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
                    Row 1 → opportunity values
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(previewDraft).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold tracking-wide text-emerald-800 uppercase">
                          {key}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {formatPreviewValue(key, value)}
                        </p>
                      </div>
                    ))}
                    {mapping.missing.map((label) => (
                      <div
                        key={label}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold tracking-wide text-rose-700 uppercase">
                          {label}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-rose-800">
                          No matching column in spreadsheet
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mapping.unmatched.length > 0 && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {mapping.unmatched.length} unmatched column
                  {mapping.unmatched.length === 1 ? '' : 's'} (red) will not write into the CRM until
                  you rename the header to a known field.
                </p>
              )}

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
                  ['update-opportunity', 'Autofill an existing opportunity (uses row 1 matched fields only)'],
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
