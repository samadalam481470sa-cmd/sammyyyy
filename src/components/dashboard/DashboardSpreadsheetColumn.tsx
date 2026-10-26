import { X } from 'lucide-react'
import type { DashboardSheet } from '@/lib/dashboardSpreadsheets'

interface DashboardSpreadsheetColumnProps {
  sheet: DashboardSheet
  onCell: (rowIndex: number, columnIndex: number, value: string) => void
  onHeader: (columnIndex: number, value: string) => void
  onRemove: () => void
}

export function DashboardSpreadsheetColumn({
  sheet,
  onCell,
  onHeader,
  onRemove,
}: DashboardSpreadsheetColumnProps) {
  return (
    <section className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-surface">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <h2 className="font-brand text-base font-semibold text-navy-900">{sheet.title}</h2>
          <p className="truncate text-[11px] text-ink-subtle">{sheet.sourceName}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-border p-1.5 text-ink-muted hover:bg-canvas"
          aria-label={`Remove ${sheet.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="custom-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-canvas">
            <tr>
              {sheet.headers.map((header, columnIndex) => (
                <th key={`${sheet.id}-h-${columnIndex}`} className="border-b border-border p-1">
                  <input
                    value={header}
                    aria-label={`${sheet.title} column ${columnIndex + 1}`}
                    onChange={(event) => onHeader(columnIndex, event.target.value)}
                    className="h-8 w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1.5 font-semibold text-ink outline-none focus:border-accent"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={`${sheet.id}-r-${rowIndex}`}>
                {sheet.headers.map((_, columnIndex) => (
                  <td key={`${sheet.id}-${rowIndex}-${columnIndex}`} className="border-b border-border p-1">
                    <input
                      value={row[columnIndex] ?? ''}
                      aria-label={`${sheet.title} row ${rowIndex + 1} column ${columnIndex + 1}`}
                      onChange={(event) => onCell(rowIndex, columnIndex, event.target.value)}
                      className="h-8 w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1.5 text-ink outline-none focus:border-accent focus:bg-white"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
