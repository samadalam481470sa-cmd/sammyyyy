import { useRef, useState } from 'react'
import { CreationDrawer } from '@/components/shared/CreationDrawer'
import type { OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { DealLeadEditor } from '@/components/dealLeads/DealLeadEditor'
import type { DealLeadsApi } from '@/hooks/useDealLeads'
import type { DealLead } from '@/lib/dealLeads'

/** The centered creation modal, from the Deal Leads page and the Dashboard quick action. */
export function NewDealLeadModal({ open, mode, roster, onClose, onCreated }: { open: boolean; mode: 'create' | 'self'; roster: DealLeadsApi; onClose: () => void; onCreated?: (lead: DealLead) => void }) {
  const editor = useRef<OpportunityEditorHandle>(null)
  const [key, setKey] = useState(0)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setKey((k) => k + 1)
  }
  return (
    <CreationDrawer open={open} label={mode === 'self' ? 'Add Myself as Deal Lead' : 'New Deal Lead'} testId="new-deal-lead-modal" onRequestClose={() => (editor.current ? editor.current.requestLeave(onClose) : onClose())}>
      <DealLeadEditor
        key={key}
        ref={editor}
        roster={roster}
        mode={mode}
        lead={null}
        onClose={onClose}
        onSaved={(created) => {
          onCreated?.(created)
          onClose()
        }}
      />
    </CreationDrawer>
  )
}
