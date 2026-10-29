import { useEffect, useRef, type ReactNode } from 'react'

interface CreationDrawerProps {
  open: boolean
  /** Called for the backdrop and Escape. The editor inside decides whether unsaved work needs a prompt. */
  onRequestClose: () => void
  label: string
  children: ReactNode
  testId?: string
}

/**
 * Right-side drawer for CREATING a record, with the rest of the CRM dimmed and blocked —
 * the same interaction as New Opportunity. Editing an existing record does not use this.
 */
export function CreationDrawer({ open, onRequestClose, label, children, testId }: CreationDrawerProps) {
  const panel = useRef<HTMLElement>(null)
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button')
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-confirm-dialog="open"]')) {
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key === 'Tab' && panel.current) {
        const focusable = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
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
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" data-testid={testId}>
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-navy-950/40" aria-label={`Close ${label}`} onClick={() => closeRef.current()} />
      <aside
        ref={panel}
        className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-(--shadow-drawer)"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </aside>
    </div>
  )
}
