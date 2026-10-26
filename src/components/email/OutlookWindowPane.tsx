import { outlookWebUrl } from '@/lib/outlookWindow'

interface OutlookWindowPaneProps {
  email: string
  tenantId?: string | null
  blocked: boolean
  onOpen: () => void
}

export function OutlookWindowPane({ email, tenantId, blocked, onOpen }: OutlookWindowPaneProps) {
  const url = outlookWebUrl(email, tenantId)
  const host = new URL(url).host

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface px-6 py-8 shadow-(--shadow-card) sm:px-8">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Outlook</p>
        <h2 className="mt-2 font-brand text-3xl font-semibold text-navy-900">Outlook mail</h2>
        <p className="mt-4 text-sm font-semibold text-navy-900">{email || 'Sign in to open a mailbox'}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Microsoft displays Outlook in its own secure window.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Any Gmail account already linked inside Outlook is available in that window. Mail sent from the Newport mailbox uses this Microsoft account.
        </p>
        <button
          type="button"
          onClick={onOpen}
          data-testid="outlook-open-window"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
        >
          Show Outlook window
        </button>
        <p className="mt-3 text-xs text-ink-subtle">{host}</p>
        {blocked && (
          <p className="mt-3 text-sm text-attention" data-testid="outlook-popup-blocked">
            The browser blocked the Outlook window. Click the button to open it.
          </p>
        )}
      </div>
    </div>
  )
}
