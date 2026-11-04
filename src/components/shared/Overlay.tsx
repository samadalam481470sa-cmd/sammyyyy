import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Shared overlay shells.
 * - SideDrawer: full-height right drawer for EDITING an existing record (and read-only detail views).
 * - CenteredModal: centered white dialog for CREATING a record.
 * Both dim and blur the page behind them, block it, trap focus, and close on Escape or a backdrop
 * click through onRequestClose. The editor inside decides whether unsaved work needs a prompt.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open overlays, newest last. Only the top one reacts to Escape. */
const stack: symbol[] = []

function useOverlayBehavior(open: boolean, panel: React.RefObject<HTMLElement | null>, onRequestClose: () => void, autoFocus: boolean) {
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose
  useEffect(() => {
    if (!open) return
    const id = Symbol('overlay')
    stack.push(id)
    const previous = document.activeElement as HTMLElement | null
    if (autoFocus) {
      const first = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')
      ;(first ?? panel.current)?.focus({ preventScroll: true })
    } else {
      panel.current?.focus({ preventScroll: true })
    }
    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (event.key === 'Escape') {
        if (document.querySelector('[data-confirm-dialog="open"], [role="alertdialog"]')) return
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key === 'Tab' && panel.current) {
        const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!focusable.length) return
        const firstEl = focusable[0]
        const lastEl = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault()
          lastEl.focus()
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      const at = stack.indexOf(id)
      if (at >= 0) stack.splice(at, 1)
      if (!stack.length) document.body.style.overflow = overflow
      previous?.focus?.({ preventScroll: true })
    }
  }, [open, panel, autoFocus])
}

const BACKDROP = 'absolute inset-0 bg-navy-950/45 backdrop-blur-[3px]'

interface SideDrawerProps {
  open: boolean
  onRequestClose: () => void
  label: string
  children: ReactNode
  /** Tailwind max-width class. Default fits a form comfortably. */
  width?: string
  testId?: string
}

export function SideDrawer({ open, onRequestClose, label, children, width = 'max-w-[560px]', testId }: SideDrawerProps) {
  const panel = useRef<HTMLElement>(null)
  useOverlayBehavior(open, panel, onRequestClose, false)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" data-testid={testId}>
      <button type="button" tabIndex={-1} className={BACKDROP} aria-label={`Close ${label}`} onClick={onRequestClose} />
      <aside
        ref={panel}
        tabIndex={-1}
        className={`relative flex h-full w-full ${width} flex-col overflow-hidden bg-surface shadow-(--shadow-drawer) outline-none`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </aside>
    </div>
  )
}

interface CenteredModalProps {
  open: boolean
  onRequestClose: () => void
  label: string
  children: ReactNode
  width?: string
  testId?: string
}

export function CenteredModal({ open, onRequestClose, label, children, width = 'max-w-xl', testId }: CenteredModalProps) {
  const panel = useRef<HTMLElement>(null)
  useOverlayBehavior(open, panel, onRequestClose, true)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" data-testid={testId}>
      <button type="button" tabIndex={-1} className={BACKDROP} aria-label={`Close ${label}`} onClick={onRequestClose} />
      <section
        ref={panel}
        tabIndex={-1}
        className={`relative flex max-h-[min(92dvh,900px)] w-full ${width} flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-(--shadow-elevated) outline-none`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </section>
    </div>
  )
}

/** Navy header used by every edit drawer. */
export function DrawerHeader({
  eyebrow,
  title,
  subtitle,
  onClose,
  closeLabel = 'Close',
  children,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  onClose?: () => void
  closeLabel?: string
  /** Extra rows under the title (badges, warning, lead, next action). */
  children?: ReactNode
  /** Buttons placed left of the X. */
  actions?: ReactNode
}) {
  return (
    <header className="shrink-0 bg-navy-900 px-5 pt-4 pb-4 text-white" data-testid="drawer-header">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold tracking-[0.12em] text-accent-muted uppercase">{eyebrow}</p>}
          <h2 className="mt-0.5 truncate font-brand text-2xl leading-tight font-bold text-white">{title}</h2>
          {subtitle && <p className="truncate text-sm text-white/75">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {children && <div className="mt-3 space-y-2">{children}</div>}
    </header>
  )
}

/** White header used by creation modals. */
export function ModalHeader({ eyebrow, title, subtitle, onClose, closeLabel = 'Close' }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; onClose?: () => void; closeLabel?: string }) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">{eyebrow}</p>}
        <h2 className="mt-0.5 font-brand text-xl font-bold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={closeLabel} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </header>
  )
}

/** Initials avatar. "?" when nobody is assigned. */
export function InitialsAvatar({ name, size = 'sm', tone = 'navy' }: { name: string | null | undefined; size?: 'xs' | 'sm' | 'md'; tone?: 'navy' | 'light' }) {
  const clean = (name ?? '').trim()
  const initials = clean
    ? clean
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join('')
    : '?'
  const dims = size === 'xs' ? 'h-5 w-5 text-[9px]' : size === 'md' ? 'h-9 w-9 text-xs' : 'h-7 w-7 text-[10px]'
  const colors = !clean
    ? 'bg-canvas text-ink-muted border border-dashed border-border-strong'
    : tone === 'light'
      ? 'bg-white/15 text-white ring-1 ring-white/30'
      : 'bg-navy-900 text-white'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${colors}`} aria-hidden="true">
      {initials}
    </span>
  )
}
