import { useCallback, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { ExcelImportModal } from '@/components/dashboard/ExcelImportModal'
import { useSpreadsheetColumns } from '@/components/dashboard/SpreadsheetColumnContext'
import { useData } from '@/data/DataContext'
import { mockContacts } from '@/data/mockModules'
import { loadOwnedCollection, saveOwnedCollection } from '@/lib/demoStore'
import type { ImportRow } from '@/lib/excelImport'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { isLocalPersistence } from '@/lib/persistenceMode'

/**
 * The existing Excel importer behind one button (moved here from the Dashboard quick actions).
 * Import, validation and the effect on records are unchanged. It imports records from a
 * spreadsheet; it has nothing to do with the database backup file.
 */
export function ExcelImportAction() {
  const { opportunities, createOpportunity, saveOpportunity, createTask } = useData()
  const { user } = useAuth()
  const owner = sessionOwnerKey(user)
  const { addSheet } = useSpreadsheetColumns()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const keepSpreadsheet = useCallback(
    (grid: Parameters<typeof addSheet>[0], sourceName: string) => {
      addSheet(grid, sourceName)
      setNote('Spreadsheet column added. It shows beside the sidebar on the Dashboard.')
    },
    [addSheet],
  )
  return (
    <>
      <button type="button" data-testid="settings-import-excel" onClick={() => setOpen(true)} className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-navy-900 bg-surface px-4 text-sm font-semibold text-navy-900 hover:bg-accent-soft sm:w-auto">
        Import Excel
      </button>
      {note && <p data-testid="settings-import-excel-note" className="text-sm text-navy-800">{note}</p>}
      <ExcelImportModal
        open={open}
        onClose={() => setOpen(false)}
        opportunities={opportunities}
        onCreateOpportunities={async (drafts) => {
          for (const d of drafts) {
            await createOpportunity(d)
          }
          setNote(`Imported ${drafts.length} opportunit${drafts.length === 1 ? 'y' : 'ies'}`)
        }}
        onUpdateOpportunity={async (id, patch) => {
          await saveOpportunity(id, patch)
          setNote('Opportunity autofilled from Excel')
        }}
        onImportTasks={async (rows: ImportRow[]) => {
          for (const [i, r] of rows.entries()) {
            await createTask({
              action: String(r.action ?? r.nextAction ?? r.name ?? `Imported task ${i + 1}`),
              priority: String(r.priority ?? 'B'),
              owner: String(r.dealLead ?? r.owner ?? ''),
              projectName: String(r.projectName ?? ''),
              dueDate: r.nextActionDate != null ? String(r.nextActionDate) : null,
              status: 'Open',
              notes: String(r.notes ?? 'Excel import'),
            })
          }
        }}
        onKeepAsColumn={keepSpreadsheet}
        onImportContacts={async (rows: ImportRow[]) => {
          if (isLocalPersistence()) {
            const existing = loadOwnedCollection('contacts', owner, mockContacts)
            const mapped = rows.map((r, i) => ({
              id: `con_import_${Date.now()}_${i}`,
              name: String(r.name ?? r.entityName ?? `Contact ${i + 1}`),
              title: String(r.title ?? ''),
              company: String(r.company ?? r.entityName ?? ''),
              category: 'Other',
              email: String(r.email ?? ''),
              phone: String(r.phone ?? ''),
              opportunityId: null,
              projectName: String(r.projectName ?? ''),
              status: 'Active',
              lastContactDate: null,
              notes: String(r.notes ?? 'Excel import'),
            }))
            saveOwnedCollection('contacts', owner, [...mapped, ...existing])
          }
        }}
      />
    </>
  )
}
