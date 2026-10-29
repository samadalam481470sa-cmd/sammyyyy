import { useRef, useState } from 'react'
import type { TaskRecord } from '@/data/mockModules'
import { CreationDrawer } from '@/components/shared/CreationDrawer'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { emptyTaskDraft, TaskEditor, type TaskDraft } from '@/components/tasks/TaskEditor'

interface NewTaskDrawerProps {
  open: boolean
  onClose: () => void
  onCreated?: (task: TaskRecord) => void
  /** Optional starting values, e.g. the opportunity when opened from a profile. */
  seed?: Partial<TaskDraft>
}

/** The New Task form used on Tasks, the Dashboard, and opportunity profiles, as a dimmed creation drawer. */
export function NewTaskDrawer({ open, onClose, onCreated, seed }: NewTaskDrawerProps) {
  const editor = useRef<OpportunityEditorHandle>(null)
  const [key, setKey] = useState(0)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setKey((k) => k + 1)
  }
  const draftSeed = { ...emptyTaskDraft(), ...seed }
  return (
    <CreationDrawer open={open} label="New Task" testId="new-task-drawer" onRequestClose={() => (editor.current ? editor.current.requestLeave(onClose) : onClose())}>
      <TaskEditor
        key={key}
        ref={editor}
        mode="draft"
        draftSeed={draftSeed}
        onClose={onClose}
        onSaved={(created) => {
          onCreated?.(created)
          onClose()
        }}
      />
    </CreationDrawer>
  )
}
