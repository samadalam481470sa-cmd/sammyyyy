import { useEffect, useState, type ChangeEvent } from 'react'
import { Settings } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useData, type LastImport } from '@/data/DataContext'
import { InstallAppButton } from '@/components/shared/InstallAppButton'
import { ExcelImportAction } from '@/components/dashboard/ExcelImportAction'
import { ImportReview } from '@/components/settings/ImportReview'
import { loadCrmMeetings } from '@/lib/crmMeetings'
import { calendarOwnerKey, calendarOwnerLabel } from '@/lib/meetingCalendar'
import { SCHEMA_VERSION } from '@/lib/portableDatabase'
import type { ImportPreview, ImportResult } from '@/lib/safeImport'

const card = 'min-w-0 rounded-xl border border-border bg-surface p-4 shadow-(--shadow-card)'
const heading = 'font-brand text-base font-bold text-navy-900'
const secondary = 'inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink hover:bg-canvas'

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const { user } = useAuth()
  const { downloadDatabase, previewImport, undoLastImport, lastImport, localBackup, sync } = useData()
  const shared = sync.state !== 'local'
  const [importError, setImportError] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [last, setLast] = useState<LastImport | null>(() => lastImport())
  const [deviceCopy, setDeviceCopy] = useState<Blob | null>(null)

  useEffect(() => {
    let live = true
    void localBackup().then((blob) => {
      if (live) setDeviceCopy(blob)
    })
    return () => {
      live = false
    }
  }, [localBackup])

  const review = async (file: Blob) => {
    setImportError(null)
    setImportNote(null)
    const result = await previewImport(file)
    if ('error' in result) setImportError(result.error)
    else setPreview(result.preview)
  }
  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await review(file)
  }
  const onDone = (result: ImportResult) => {
    setPreview(null)
    setLast(lastImport())
    const parts = [`${result.added} added`]
    if (result.replaced) parts.push(`${result.replaced} replaced`)
    if (result.keptDeleted) parts.push(`${result.keptDeleted} stayed deleted because someone removed them`)
    if (result.failed.length) parts.push(`${result.failed.length} not imported because they changed during the import`)
    setImportNote(`Import finished: ${parts.join(', ')}.`)
  }
  const undo = () => {
    void undoLastImport()
      .then(({ removed, kept }) => {
        setLast(null)
        setImportNote(`Removed ${removed} imported record${removed === 1 ? '' : 's'}.${kept ? ` ${kept} stayed because someone has edited them.` : ''}`)
      })
      .catch((err: unknown) => setImportError(err instanceof Error ? err.message : 'The import could not be undone.'))
  }
  const downloadMeetings = () => {
    const rows = loadCrmMeetings(calendarOwnerKey(user))
    saveFile(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), owner: user?.email ?? '', meetings: rows }, null, 2)], { type: 'application/json' }), 'newport-crm-my-meetings.json')
  }

  return (
    <div data-testid="settings-page" className="flex h-dvh max-h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-canvas lg:overflow-hidden">
      <header className="shrink-0 border-b border-border bg-surface px-6 py-3 lg:px-8">
        <h1 className="font-brand text-xl font-bold text-navy-900">Settings</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Your session, company records, backups and imports.</p>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] min-w-0 flex-1 grid-cols-1 content-start gap-3 px-4 py-3 sm:px-6 lg:min-h-0 lg:grid-cols-2 lg:px-8">
        <section className={card}>
          <div className="mb-2 flex items-center gap-2">
            <Settings className="h-4 w-4 text-accent" />
            <h2 className={heading}>This Session</h2>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[10px] leading-5 font-semibold tracking-[0.1em] text-ink-subtle uppercase">Signed in as</dt>
            <dd className="min-w-0 truncate font-medium text-ink" title={user?.email}>{user?.name ?? '—'} · <span className="font-normal text-ink-muted">{user?.email}</span></dd>
            <dt className="text-[10px] leading-5 font-semibold tracking-[0.1em] text-ink-subtle uppercase">Account</dt>
            <dd className="min-w-0 truncate text-ink">{calendarOwnerLabel(user)}</dd>
          </dl>
          <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-muted" data-testid="settings-storage-note">
            {sync.state === 'synced' || sync.state === 'saving'
              ? "Opportunities, tasks, relationships, documents, deal leads and activity are saved on Newport's server and shared with every approved user. Your meetings, transcripts, summaries, Outlook calendar and email are private to your account."
              : sync.state === 'local'
                ? 'No shared server is connected. Records are saved in this browser only, and other people cannot see them.'
                : 'The shared server is not reachable right now, so recent changes may not be shared yet. Your meetings, calendar and email stay private to your account.'}
          </p>
        </section>

        <section data-testid="settings-excel" className={card}>
          <h2 className={heading}>Excel Import</h2>
          <p className="mt-1 mb-3 text-sm leading-relaxed text-ink-muted">
            Add opportunities, tasks or contacts from a spreadsheet. You review the rows first, and {shared ? 'saved rows go to the shared records' : 'saved rows stay in this browser'}.
          </p>
          <ExcelImportAction />
        </section>

        <section data-testid="settings-database" className={card}>
          <h2 className={heading}>Database Backup</h2>
          <p data-testid="database-status" className="mt-1 text-sm text-ink">
            Schema version {SCHEMA_VERSION}. {shared ? "The server keeps its own daily copies." : 'This browser holds the only copy.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-testid="download-database" onClick={downloadDatabase} className="inline-flex h-9 items-center justify-center rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-800">
              Download company records
            </button>
            <button type="button" data-testid="download-my-meetings" onClick={downloadMeetings} className={secondary}>
              Download my meetings
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Company records never include anyone's meetings. Your meetings file has only your own.</p>
        </section>

        <section data-testid="settings-import" className={card}>
          <h2 className={heading}>Import a Backup</h2>
          <p className="mt-1 text-sm text-ink-muted">Compares the file with live records first. It only adds what you approve, and never overwrites the database on its own.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="import-database" className={`${secondary} cursor-pointer`}>
              Choose backup file (JSON)
            </label>
            <input id="import-database" data-testid="import-database" type="file" accept="application/json,.json" onChange={(event) => void onImport(event)} className="sr-only" />
            {deviceCopy && (
              <>
                <button type="button" data-testid="review-device-copy" onClick={() => void review(deviceCopy)} className={secondary}>
                  Review this device's earlier data
                </button>
                <button type="button" data-testid="download-device-copy" onClick={() => saveFile(deviceCopy, (deviceCopy as File).name || 'newport-crm-this-device.json')} className="text-xs font-semibold text-navy-900 hover:underline">
                  Download it
                </button>
              </>
            )}
            {last && (
              <button type="button" data-testid="undo-import" onClick={undo} className="text-xs font-semibold text-navy-900 hover:underline">
                Undo last import ({last.added.length})
              </button>
            )}
          </div>
          {importError && <p role="alert" data-testid="database-import-error" className="mt-2 text-sm text-attention">{importError}</p>}
          {importNote && <p data-testid="database-import-ok" className="mt-2 text-sm text-navy-800">{importNote}</p>}
        </section>

        <section className={`${card} lg:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className={heading}>Install App</h2>
              <p className="text-sm text-ink-muted">The installed app opens the live site in its own window, so updates apply the next time it opens.</p>
            </div>
            <InstallAppButton />
          </div>
        </section>
      </div>

      {preview && <ImportReview preview={preview} shared={sync.state === 'synced' || sync.state === 'saving'} onClose={() => setPreview(null)} onDone={onDone} />}
    </div>
  )
}
