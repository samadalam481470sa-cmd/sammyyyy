import { useRef, useState } from 'react'
import { mockContacts, type ContactRecord } from '@/data/mockModules'
import { useResource, type ResourceApi } from '@/hooks/useResource'
import { CreationDrawer } from '@/components/shared/CreationDrawer'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { RelationshipEditor } from '@/components/relationships/RelationshipEditor'

interface NewRelationshipDrawerProps {
  open: boolean
  onClose: () => void
  onCreated?: (contact: ContactRecord) => void
  /** The page's own contacts collection, when it already has one. */
  api?: ResourceApi<ContactRecord>
  seedProjectIds?: string[]
}

function Drawer({ open, onClose, onCreated, api, seedProjectIds }: NewRelationshipDrawerProps & { api: ResourceApi<ContactRecord> }) {
  const editor = useRef<OpportunityEditorHandle>(null)
  const [key, setKey] = useState(0)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setKey((k) => k + 1)
  }
  return (
    <CreationDrawer open={open} label="New Relationship" testId="new-relationship-drawer" onRequestClose={() => (editor.current ? editor.current.requestLeave(onClose) : onClose())}>
      <RelationshipEditor
        key={key}
        ref={editor}
        api={api}
        contact={null}
        seedProjectIds={seedProjectIds}
        onClose={onClose}
        onSaved={(created) => {
          onCreated?.(created)
          onClose()
        }}
      />
    </CreationDrawer>
  )
}

function DrawerWithOwnApi(props: NewRelationshipDrawerProps) {
  const api = useResource<ContactRecord>('contacts', mockContacts)
  return <Drawer {...props} api={api} />
}

/** The New Relationship form as a dimmed creation drawer (Relationships page, Dashboard, profiles). */
export function NewRelationshipDrawer(props: NewRelationshipDrawerProps) {
  if (props.api) return <Drawer {...props} api={props.api} />
  if (!props.open) return null
  return <DrawerWithOwnApi {...props} />
}
