import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { fetchDefenseStatus, liftDefenseBlock, type DefenseStatus } from '@/lib/workspaceSync'

const LABELS: Record<string, string> = {
  auth_failure: 'Failed sign-in',
  invalid_session: 'Invalid session token',
  blocked_request: 'Blocked address tried again',
  block_started: 'Address blocked',
  block_lifted: 'Block lifted',
  scanner_probe: 'Scanner probe',
  sql_injection_probe: 'SQL injection probe',
  path_traversal_probe: 'Path traversal probe',
  xss_probe: 'Script injection probe',
  rate_limit: 'Rate limit reached',
  flood: 'Request flood',
  unsafe_json: 'Unsafe request body',
  bad_upload: 'Refused file upload',
  denied_origin: 'Unapproved website',
  denied_record_write: 'Refused record change',
}

const label = (type: string) => LABELS[type] ?? type
// The server stores UTC with no zone marker.
const when = (at: string) => new Date(`${at.replace(' ', 'T')}Z`).toLocaleString()

/** What the server has blocked and refused. Attacker text is shown as plain text only. */
export function DefensePanel({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<DefenseStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setStatus(await fetchDefenseStatus())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The attack log could not be loaded.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const lift = async (ip: string) => {
    try {
      await liftDefenseBlock(ip)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The block could not be lifted.')
    }
  }

  const warnings = status
    ? [
        !status.posture.approvedListSet && 'No approved sign-in list is set, so the server refuses every Microsoft account.',
        status.posture.administrators === 0 && 'ADMIN_EMAILS is empty, so no Microsoft account has administrator rights.',
        !status.posture.demoSignInOff && 'Demo sign-in is on. Turn off ALLOW_DEMO_SIGNIN on this server.',
      ].filter(Boolean)
    : []

  return (
    <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-(--shadow-card) lg:min-h-0" data-testid="defense-panel">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-accent" />
          <h2 className="font-brand text-lg font-bold text-navy-900">Attack defense</h2>
        </div>
        <span className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-canvas disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-canvas">
            <ArrowLeft className="h-3.5 w-3.5" /> Change history
          </button>
        </span>
      </div>
      <div className="custom-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {error && <p className="text-sm text-attention" data-testid="defense-error">{error}</p>}
        {warnings.map((text) => (
          <p key={String(text)} className="rounded-lg border border-[#f0e2bd] bg-[#fdf7e7] px-3 py-2 text-xs text-[#7a5c1e]">{text}</p>
        ))}
        {status && (
          <>
            <div>
              <h3 className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Blocked addresses ({status.activeBlocks.length})</h3>
              {status.activeBlocks.length === 0 && <p className="mt-1 text-sm text-ink-muted">No address is blocked right now.</p>}
              <ul className="mt-1 divide-y divide-border">
                {status.activeBlocks.map((block) => (
                  <li key={block.ip} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-ink">{block.ip}</span>
                      <span className="ml-2 text-xs text-ink-muted">{label(block.reason)} · until {new Date(block.blockedUntil).toLocaleString()}</span>
                    </span>
                    <button type="button" onClick={() => void lift(block.ip)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-navy-900 hover:bg-canvas">Lift block</button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Last 24 hours</h3>
              {status.last24h.length === 0 && <p className="mt-1 text-sm text-ink-muted">Nothing suspicious was recorded.</p>}
              <p className="mt-1 flex flex-wrap gap-1.5">
                {status.last24h.map((row) => (
                  <span key={row.type} className="rounded-full border border-border bg-canvas px-2.5 py-0.5 text-xs font-semibold text-navy-900">{label(row.type)}: {row.count}</span>
                ))}
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">Counts record at most one entry per type, address and minute, so an attack cannot flood this log.</p>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Latest events</h3>
              <ul className="mt-1 divide-y divide-border">
                {status.events.map((event) => (
                  <li key={event.id} className="py-2 text-xs">
                    <span className="font-semibold text-ink">{label(event.type)}</span>
                    {event.ip && <span className="ml-2 font-mono text-ink-muted">{event.ip}</span>}
                    <span className="ml-2 text-ink-subtle">{when(event.createdAt)}</span>
                    {event.detail && <span className="mt-0.5 block break-all text-ink-muted">{event.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
