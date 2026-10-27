import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { mailboxCheck, type MailboxCheckRow } from '@/lib/outlookSync'
import { MAIL_FOLDERS } from '@/lib/outlookMailbox'

function Shell({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" data-testid={testId}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#242424]">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-[#616161] hover:bg-[#f0f0f0]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 text-sm text-[#242424]">{children}</div>
      </div>
    </div>
  )
}

const STATE_LABEL: Record<MailboxCheckRow['state'], string> = {
  not_connected: 'Not connected',
  loading: 'Loading',
  current: 'Up to date',
  failed: 'Sync failed',
}

/** Read-only check of which mailbox each connection reads and whether mail is arriving (guide p4, p11). */
export function MailboxCheckDialog({ email, onClose, onResync }: { email: string; onClose: () => void; onResync: () => void }) {
  const [rows, setRows] = useState<MailboxCheckRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancel = false
    mailboxCheck(email)
      .then((result) => !cancel && setRows(result))
      .catch((err) => !cancel && setError(err instanceof Error ? err.message : 'The mailbox check failed.'))
    return () => {
      cancel = true
    }
  }, [email])

  return (
    <Shell title="Mailbox check" onClose={onClose} testId="mailbox-check">
      <p className="text-xs text-[#616161]">
        Shows which mailbox each connection really reads, how many messages the provider holds, and how many are loaded here. No message contents
        or passwords are shown.
      </p>
      {error && <p className="mt-3 text-[#c50f1f]">{error}</p>}
      {!rows && !error && (
        <p className="mt-4 inline-flex items-center gap-2 text-[#616161]">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking with Microsoft and Google…
        </p>
      )}
      {rows?.map((row) => (
        <section key={row.provider} className="mt-4 rounded-lg border border-[#e0e0e0] p-3" data-testid={`mailbox-check-${row.provider}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{row.provider === 'outlook' ? 'Outlook (Microsoft)' : 'Gmail (Google)'}</h3>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${row.state === 'current' ? 'text-[#107c10]' : row.state === 'failed' ? 'text-[#c50f1f]' : 'text-[#616161]'}`}>
              {row.state === 'current' ? <CheckCircle2 className="h-3.5 w-3.5" /> : row.state === 'failed' ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
              {STATE_LABEL[row.state]}
            </span>
          </div>
          {row.connected ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-[#616161]">Mailbox address</dt>
              <dd className="font-medium">{row.address || 'Unknown'}</dd>
              {row.signInName && row.signInName !== row.address && (
                <>
                  <dt className="text-[#616161]">Signed in as</dt>
                  <dd>{row.signInName}</dd>
                </>
              )}
              {row.provider === 'outlook' && (
                <>
                  <dt className="text-[#616161]">Account type</dt>
                  <dd>{row.personal ? 'Personal Microsoft account' : 'Work or school account'}</dd>
                </>
              )}
              <dt className="text-[#616161]">Last successful sync</dt>
              <dd>{row.lastSync ? new Date(row.lastSync).toLocaleString() : 'Not yet'}</dd>
              {row.error && (
                <>
                  <dt className="text-[#616161]">Last error</dt>
                  <dd className="text-[#c50f1f]">{row.error}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-[#616161]">Not connected. Use Connect {row.provider === 'outlook' ? 'Outlook' : 'Gmail'} on the Email page.</p>
          )}
          {row.warning && <p className="mt-2 rounded-md bg-[#fff8e6] px-2 py-1.5 text-xs text-[#7a5b00]">{row.warning}</p>}
          {row.connected && (
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-[#616161]">
                <tr>
                  <th className="py-1 font-medium">Folder</th>
                  <th className="py-1 font-medium">On server</th>
                  <th className="py-1 font-medium">Unread</th>
                  <th className="py-1 font-medium">Loaded here</th>
                </tr>
              </thead>
              <tbody>
                {row.folders.map((folder) => (
                  <tr key={folder.folder} className="border-t border-[#f0f0f0]">
                    <td className="py-1">{MAIL_FOLDERS.find((item) => item.id === folder.folder)?.label}</td>
                    <td className="py-1">{folder.serverTotal ?? '—'}</td>
                    <td className="py-1">{folder.serverUnread ?? '—'}</td>
                    <td className="py-1">{folder.loaded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      {rows && (
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onResync} className="h-9 rounded-md bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3]">
            Full resync now
          </button>
        </div>
      )}
    </Shell>
  )
}

const SHORTCUTS: [string, string][] = [
  ['J or ↓', 'Next message'],
  ['K or ↑', 'Previous message'],
  ['Enter', 'Open message'],
  ['N', 'New mail'],
  ['R', 'Reply'],
  ['A', 'Reply all'],
  ['F', 'Forward'],
  ['E', 'Archive'],
  ['Delete or #', 'Delete'],
  ['U', 'Mark read / unread'],
  ['S', 'Flag or star'],
  ['X', 'Select message'],
  ['/', 'Search'],
  ['Esc', 'Close the composer or clear the selection'],
  ['?', 'Show this list'],
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="Keyboard shortcuts" onClose={onClose} testId="mail-shortcuts">
      <p className="text-xs text-[#616161]">Shortcuts work in the message list and reading pane, never while you are typing.</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt>
              <kbd className="rounded border border-[#e0e0e0] bg-[#f5f5f5] px-1.5 py-0.5 text-xs font-semibold">{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </Shell>
  )
}

const SUPPORTED = [
  'Outlook (work, school, personal) and Gmail in one inbox, each message marked with its account',
  'Inbox, Sent, Drafts, Junk, Deleted, and Archive for both accounts, with unread counts from the provider',
  'New mail within seconds while the app is open; full refresh and a mailbox check on demand',
  'Read and unread, flag (Outlook) and star (Gmail), archive, delete, restore, junk and not junk',
  'Select several messages and act on them together, with a result for each message',
  'Search loaded mail instantly, or search the whole mailbox on Microsoft or Google',
  'New mail, reply, reply all, forward, drafts, attachments, signature, and a 10-second undo send',
  'Unsent messages saved on this device so a refresh does not lose them',
  'Emails shown in an isolated frame with remote images blocked until you allow them',
]

const NOT_SUPPORTED = [
  'Receiving mail while the app is closed. Instant push from Microsoft or Google needs a server, which this app does not have yet',
  'Scheduled send for later. Undo send works only while this window stays open',
  'Provider rules, filters, blocked senders, and automatic replies. Manage them in Outlook or Gmail',
  'Outlook categories, custom folders, Gmail custom labels, shared mailboxes, and encrypted or protected mail',
  'Read receipts, delivery tracking, and recall',
  'Gmail for everyone: until Google approves the app, only test users added in Google Cloud can connect Gmail',
]

/** Honest list of what the Email section does and does not do (guide p76). */
export function CapabilitiesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="What this inbox supports" onClose={onClose} testId="mail-capabilities">
      <h3 className="font-semibold">Supported and tested</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {SUPPORTED.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3 className="mt-4 font-semibold">Not available here</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[#424242]">
        {NOT_SUPPORTED.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Shell>
  )
}
