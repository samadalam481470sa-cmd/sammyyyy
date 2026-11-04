import type { ReactNode } from 'react'
import { CenteredModal } from '@/components/shared/Overlay'

interface CreationDrawerProps {
  open: boolean
  /** Called for the backdrop and Escape. The editor inside decides whether unsaved work needs a prompt. */
  onRequestClose: () => void
  label: string
  children: ReactNode
  testId?: string
  width?: string
}

/**
 * Shell for CREATING a record: a centered white modal over a dimmed, blurred page.
 * (The name is kept so every existing creation flow uses the same shell.)
 * Editing an existing record uses SideDrawer instead.
 */
export function CreationDrawer({ open, onRequestClose, label, children, testId, width }: CreationDrawerProps) {
  return (
    <CenteredModal open={open} onRequestClose={onRequestClose} label={label} testId={testId} width={width}>
      {children}
    </CenteredModal>
  )
}
