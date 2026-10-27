import { useState, type ChangeEvent } from 'react'
import { Settings } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { InstallAppButton } from '@/components/shared/InstallAppButton'
import { calendarOwnerLabel } from '@/lib/meetingCalendar'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { SCHEMA_VERSION } from '@/lib/portableDatabase'

export function SettingsPage() {
  const { user } = useAuth()
  const { downloadDatabase, importDatabase } = useData()
  const owner = sessionOwnerKey(user)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportError(null)
    setImportNote(null)
    const error = await importDatabase(file)
    if (error) setImportError(error)
    else setImportNote('Database imported on this device.')
  }

  return (
    <div data-testid="settings-page" className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Session preferences for this Microsoft, Outlook, Gmail, or work email. Sign out ends this
          session and keeps every edit; signing back in with the same email restores them.
        </p>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-[720px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" />
            <h2 className="font-brand text-lg font-bold text-navy-900">This session</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Signed in as
              </dt>
              <dd className="mt-0.5 font-medium text-ink">{user?.name ?? '—'}</dd>
              <dd className="text-xs text-ink-muted">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Role
              </dt>
              <dd className="mt-0.5 text-ink">
                {user?.role}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">
                Data vault
              </dt>
              <dd className="mt-0.5 text-ink">{calendarOwnerLabel(user)}</dd>
              <dd className="mt-0.5 font-mono text-[11px] text-ink-muted">{owner}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-muted">
            Opportunities, relationships, tasks, documents, meetings, and calendar notes for this
            Microsoft account are written locally and restored when you return. Other Microsoft
            accounts cannot see those edits.
          </p>
        </section>

        <section
          data-testid="settings-database"
          className="mt-4 min-w-0 rounded-xl border border-border bg-surface p-5 shadow-(--shadow-card)"
        >
          <h2 className="font-brand text-lg font-bold text-navy-900">Database</h2>
          <p data-testid="database-status" className="mt-2 text-sm text-ink">
            Schema version {SCHEMA_VERSION}. This device keeps its own database.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            The installed app opens the live site in its own window, so updates apply the next time it opens and the database migrates itself.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              data-testid="download-database"
              onClick={downloadDatabase}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 sm:w-auto"
            >
              Download database
            </button>
            <div className="min-w-0">
              <label htmlFor="import-database" className="text-sm font-medium text-ink">
                Import database
              </label>
              <input
                id="import-database"
                data-testid="import-database"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void onImport(event)}
                className="mt-1 block w-full max-w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy-900"
              />
            </div>
            {importError ? (
              <p role="alert" data-testid="database-import-error" className="text-sm text-attention">
                {importError}
              </p>
            ) : null}
            {importNote ? (
              <p data-testid="database-import-ok" className="text-sm text-navy-800">
                {importNote}
              </p>
            ) : null}
            <InstallAppButton />
          </div>
        </section>
      </div>
    </div>
  )
}
