import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { CONTACT_STATUSES, type ContactRecord } from '@/data/mockModules'
import { useData } from '@/data/DataContext'
import type { ResourceApi } from '@/hooks/useResource'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { appendDemoChange } from '@/lib/demoStore'
import { saveButtonLabel } from '@/lib/persistenceMode'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CreatableSelect, matchExistingOption } from '@/components/shared/CreatableSelect'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'

export function contactProjectIds(contact: Pick<ContactRecord, 'opportunityId' | 'opportunityIds'>): string[] {
  const ids = [...(contact.opportunityIds ?? [])]
  if (contact.opportunityId && !ids.includes(contact.opportunityId)) ids.unshift(contact.opportunityId)
  return ids
}

export function blankContact(): ContactRecord {
  return {
    id: '',
    name: '',
    title: '',
    company: '',
    category: '',
    email: '',
    phone: '',
    opportunityId: null,
    opportunityIds: [],
    projectName: '',
    status: 'Active',
    lastContactDate: null,
    notes: '',
  }
}

type Draft = {
  name: string
  company: string
  title: string
  email: string
  phone: string
  category: string
  projectIds: string[]
  status: string
  lastContactDate: string
  notes: string
}

function toDraft(contact: ContactRecord | null, seedProjectIds: string[] = []): Draft {
  const row = contact ?? blankContact()
  return {
    name: row.name ?? '',
    company: row.company ?? '',
    title: row.title ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    category: row.category ?? '',
    projectIds: contact ? contactProjectIds(row) : seedProjectIds,
    status: row.status || 'Active',
    lastContactDate: row.lastContactDate ?? '',
    notes: row.notes ?? '',
  }
}

/** Compare what the user would actually save, so reverting an edit clears the unsaved state. */
function sameDraft(a: Draft, b: Draft): boolean {
  const norm = (d: Draft) =>
    JSON.stringify({ ...d, name: d.name.trim(), company: d.company.trim(), title: d.title.trim(), email: d.email.trim(), phone: d.phone.trim(), category: d.category.trim(), projectIds: [...d.projectIds].sort() })
  return norm(a) === norm(b)
}

interface RelationshipEditorProps {
  api: ResourceApi<ContactRecord>
  /** Existing relationship to edit, or null to create a new one. */
  contact: ContactRecord | null
  /** Projects pre-selected when creating (e.g. from an opportunity profile). */
  seedProjectIds?: string[]
  onClose: () => void
  onSaved?: (contact: ContactRecord) => void
  onDeleted?: () => void
  footerExtra?: ReactNode
}

const label = 'block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase'
const input = 'mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink normal-case outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

export const RelationshipEditor = forwardRef<OpportunityEditorHandle, RelationshipEditorProps>(function RelationshipEditor(
  { api, contact, seedProjectIds, onClose, onSaved, onDeleted, footerExtra },
  ref,
) {
  const { opportunities } = useData()
  const guard = useEditorGuard()
  const creating = contact == null
  // The record as loaded is the saved baseline, so opening a row is never "unsaved" (fix for first-click warning).
  const [baseline, setBaseline] = useState<Draft>(() => toDraft(contact, seedProjectIds))
  const [draft, setDraft] = useState<Draft>(() => toDraft(contact, seedProjectIds))
  const [categoryQuery, setCategoryQuery] = useState(() => contact?.category ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replacementId, setReplacementId] = useState('')
  const savingRef = useRef(false)

  useEffect(() => {
    const next = toDraft(contact, seedProjectIds)
    setBaseline(next)
    setDraft(next)
    setCategoryQuery(contact?.category ?? '')
    setError(null)
    setMessage(null)
    setPendingLeave(null)
    // Only reset when a different record is opened, never on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id])

  const dirty = !sameDraft(draft, baseline)
  const valid = draft.name.trim().length > 0
  const canSave = dirty && valid && !saving
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const requestLeave = useCallback((next: () => void) => {
    if (savingRef.current) return
    if (!dirtyRef.current) {
      next()
      return
    }
    setPendingLeave(() => next)
  }, [])

  useImperativeHandle(ref, () => ({ isDirty: () => dirtyRef.current, requestLeave }), [requestLeave])
  useEffect(() => {
    guard?.register({ isDirty: () => dirtyRef.current, requestLeave })
    return () => guard?.register(null)
  }, [guard, requestLeave])

  const categories = useMemo(() => {
    const names = new Set(api.items.map((item) => item.category.trim()).filter(Boolean))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [api.items])
  const filteredCategories = categories.filter((category) => category.toLowerCase().includes(categoryQuery.trim().toLowerCase()))

  // Companies from current records; the stored employer is always kept as an option.
  const companies = useMemo(
    () => [...new Set([...opportunities.map((opp) => opp.entityName), ...api.items.map((item) => item.company), draft.company].map((name) => name?.trim()).filter(Boolean) as string[])],
    [opportunities, api.items, draft.company],
  )
  const projectOptions = useMemo(
    () => opportunities.map((opp) => ({ id: opp.id, label: opp.projectName, detail: `${dealIdFromOpportunity(opp)} · ${opp.entityName}` })),
    [opportunities],
  )

  const persist = async (): Promise<boolean> => {
    if (savingRef.current) return false
    if (!valid) {
      setError('Name is required.')
      return false
    }
    const ids = draft.projectIds.filter((id) => opportunities.some((opp) => opp.id === id))
    const primary = ids[0] ?? null
    const primaryOpp = opportunities.find((opp) => opp.id === primary)
    const payload: Partial<ContactRecord> = {
      name: draft.name.trim(),
      company: matchExistingOption(draft.company, companies),
      title: draft.title.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      category: draft.category.trim(),
      opportunityId: primary,
      opportunityIds: ids,
      projectName: primaryOpp?.projectName ?? '',
      status: draft.status,
      lastContactDate: draft.lastContactDate || null,
      notes: draft.notes,
    }
    if (creating) {
      const email = payload.email?.toLowerCase() ?? ''
      const duplicate = email && api.items.some((item) => item.name.trim().toLowerCase() === payload.name!.toLowerCase() && item.email.trim().toLowerCase() === email)
      if (duplicate) {
        setError('A relationship with that name and email already exists.')
        return false
      }
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const result = creating ? await api.create({ ...blankContact(), ...payload }) : await api.save(contact!.id, payload)
      const snap = toDraft(result)
      setBaseline(snap)
      setDraft(snap)
      dirtyRef.current = false
      setMessage('Saved')
      onSaved?.(result)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const orphaned = (row: ContactRecord) =>
    contactProjectIds(row).filter((id) => !api.items.some((other) => other.id !== row.id && contactProjectIds(other).includes(id)))

  const remove = async () => {
    if (!contact) return
    const current = api.items.find((item) => item.id === contact.id) ?? contact
    const orphans = orphaned(current)
    if (orphans.length && !replacementId) {
      setError('Choose another relationship to cover the projects that would be left without a contact.')
      return
    }
    if (orphans.length && replacementId) {
      const replacement = api.items.find((item) => item.id === replacementId)
      if (replacement) {
        const ids = [...new Set([...contactProjectIds(replacement), ...orphans])]
        await api.save(replacement.id, { opportunityIds: ids, opportunityId: ids[0] ?? replacement.opportunityId })
      }
    }
    await api.remove(current.id)
    appendDemoChange({
      resourceType: 'contacts',
      resourceId: current.id,
      changeType: 'delete',
      changedFields: ['id'],
      actorName: 'Newport user',
      createdAt: new Date().toISOString(),
    })
    setConfirmDelete(false)
    setReplacementId('')
    dirtyRef.current = false
    onDeleted?.()
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setMessage(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="relationship-editor">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">{creating ? 'Unsaved draft' : 'Relationship'}</p>
          <h2 className="mt-1 truncate font-brand text-xl font-bold text-navy-900">{creating ? 'New Relationship' : draft.name.trim() || 'Relationship'}</h2>
          {creating && <p className="text-sm text-ink-muted">Nothing is created until you save.</p>}
        </div>
        <button type="button" aria-label="Close relationship editor" onClick={() => requestLeave(onClose)} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <label className={label}>
          Name
          <input data-testid="relationship-name" value={draft.name} onChange={(e) => set('name', e.target.value)} className={input} />
        </label>
        <div>
          <span className={label}>Company</span>
          <CreatableSelect
            testId="relationship-company"
            value={draft.company}
            options={companies}
            onChange={(value) => set('company', value)}
            placeholder="Search saved companies or type one"
            createLabel={(value) => `Use “${value}” as the company`}
          />
        </div>
        <label className={label}>
          Title
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} className={input} />
        </label>
        <label className={label}>
          Email
          <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} className={input} />
        </label>
        <label className={label}>
          Phone
          <input value={draft.phone} onChange={(e) => set('phone', e.target.value)} className={input} />
        </label>
        <label className={label}>
          Category
          <input
            value={categoryQuery}
            onChange={(e) => {
              setCategoryQuery(e.target.value)
              set('category', e.target.value.trim())
            }}
            className={input}
            placeholder="Type to filter or add"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {(filteredCategories.length ? filteredCategories : categoryQuery.trim() ? [categoryQuery.trim()] : categories).slice(0, 8).map((category) => (
            <button
              key={category}
              type="button"
              className="rounded-full border border-border px-2 py-1 text-[11px]"
              onClick={() => {
                set('category', category)
                setCategoryQuery(category)
              }}
            >
              {category}
            </button>
          ))}
        </div>
        <div>
          <span className={label}>Projects</span>
          <MultiSearchSelect
            testId="relationship-projects"
            values={draft.projectIds}
            options={projectOptions}
            onChange={(ids) => set('projectIds', ids)}
            placeholder="Search projects"
            emptyText="No matching projects"
          />
          <p className="mt-1 text-[11px] text-ink-muted">Company and projects are separate: an advisor can work for a different firm than the target.</p>
        </div>
        <label className={label}>
          Status
          <select value={draft.status} onChange={(e) => set('status', e.target.value)} className={input}>
            {CONTACT_STATUSES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Last contact
          <input type="date" value={draft.lastContactDate} onChange={(e) => set('lastContactDate', e.target.value)} className={input} />
        </label>
        <label className={label}>
          Notes
          <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} className={`${input} h-auto min-h-20 py-2`} />
        </label>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border bg-canvas px-5 py-3">
        {error && <p className="text-xs text-attention">{error}</p>}
        {message && !dirty && <p className="text-xs text-success">{message}</p>}
        {dirty && !valid && <p className="text-xs text-ink-muted">Add a name to save this relationship.</p>}
        <button
          type="button"
          data-testid="relationship-save"
          disabled={!canSave}
          onClick={() => void persist()}
          className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'}`}
        >
          {saveButtonLabel(saving)}
        </button>
        {!creating && (
          <button
            type="button"
            data-testid="relationship-delete"
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
            className="h-10 w-full rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)] disabled:opacity-60"
          >
            Delete Relationship
          </button>
        )}
        {footerExtra}
      </div>

      <UnsavedChangesDialog
        open={pendingLeave != null}
        saving={saving}
        error={error}
        recordLabel="relationship"
        onSave={() =>
          void persist().then((ok) => {
            if (!ok) return
            const next = pendingLeave
            setPendingLeave(null)
            next?.()
          })
        }
        onDiscard={() => {
          const next = pendingLeave
          setPendingLeave(null)
          dirtyRef.current = false
          next?.()
        }}
        onCancel={() => setPendingLeave(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Relationship?"
        message="This removes the person and their project links. Opportunities and companies stay. If a project would have no contact, choose a replacement first."
        confirmLabel="Delete Relationship"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
      {confirmDelete && contact && orphaned(contact).length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[90] w-80 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 shadow-(--shadow-elevated)">
          <p className="text-xs text-ink-muted">Replacement contact for projects that would have none</p>
          <SearchSelect
            value={replacementId}
            placeholder="Replacement contact"
            options={api.items.filter((item) => item.id !== contact.id).map((item) => ({ id: item.id, label: item.name }))}
            onChange={(id) => setReplacementId(id ?? '')}
          />
        </div>
      )}
    </div>
  )
})
