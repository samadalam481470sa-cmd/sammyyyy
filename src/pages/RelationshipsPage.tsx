import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useResource } from '@/hooks/useResource'
import { useData } from '@/data/DataContext'
import { CONTACT_STATUSES, mockContacts, type ContactRecord } from '@/data/mockModules'
import { appendDemoChange } from '@/lib/demoStore'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

function projectIds(contact: ContactRecord): string[] {
  const ids = [...(contact.opportunityIds ?? [])]
  if (contact.opportunityId && !ids.includes(contact.opportunityId)) ids.unshift(contact.opportunityId)
  return ids
}

function blank(): ContactRecord {
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

export function RelationshipsPage() {
  const api = useResource<ContactRecord>('contacts', mockContacts)
  const { opportunities } = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<ContactRecord>(blank())
  const [baseline, setBaseline] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All Relationships')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replacementId, setReplacementId] = useState('')

  const categories = useMemo(() => {
    const names = new Set(api.items.map((item) => item.category.trim()).filter(Boolean))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [api.items])

  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return api.items.filter((item) => {
      if (status !== 'All Relationships' && item.status !== status) return false
      if (!q) return true
      return `${item.name} ${item.company} ${item.title} ${item.category} ${item.projectName}`.toLowerCase().includes(q)
    })
  }, [api.items, search, status])

  const dirty = JSON.stringify(draft) !== baseline
  const canSave = draft.name.trim().length > 0 && (creating ? dirty : dirty)

  const openExisting = (contact: ContactRecord) => {
    const next = { ...contact, opportunityIds: projectIds(contact) }
    setCreating(false)
    setSelectedId(contact.id)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setCategoryQuery(contact.category)
    setError(null)
  }

  const requestSelect = (id: string) => {
    if (selectedId === id && !creating) {
      if (dirty) setPendingLeave(() => () => setSelectedId(null))
      else setSelectedId(null)
      return
    }
    const contact = api.items.find((item) => item.id === id)
    if (!contact) return
    if (dirty) setPendingLeave(() => () => openExisting(contact))
    else openExisting(contact)
  }

  const startCreate = () => {
    const next = blank()
    setCreating(true)
    setSelectedId('new')
    setDraft(next)
    setBaseline(JSON.stringify(blank()))
    setCategoryQuery('')
    setError(null)
  }

  const save = async () => {
    if (!draft.name.trim()) {
      setError('Name is required.')
      return
    }
    const ids = draft.opportunityIds ?? []
    const primary = ids[0] ?? null
    const primaryOpp = opportunities.find((opp) => opp.id === primary)
    const category = draft.category.trim()
    const payload: Partial<ContactRecord> = {
      ...draft,
      name: draft.name.trim(),
      company: draft.company.trim(),
      title: draft.title.trim(),
      category,
      opportunityId: primary,
      opportunityIds: ids,
      projectName: primaryOpp?.projectName ?? draft.projectName,
    }
    try {
      if (creating) {
        const duplicate = api.items.some(
          (item) => item.name.trim().toLowerCase() === payload.name!.toLowerCase() && item.email.trim().toLowerCase() === draft.email.trim().toLowerCase() && draft.email.trim(),
        )
        if (duplicate) {
          setError('A relationship with that name and email already exists.')
          return
        }
        const created = await api.create(payload)
        openExisting(created)
        setCreating(false)
      } else if (selectedId) {
        const saved = await api.save(selectedId, payload)
        openExisting(saved)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const orphaned = (contact: ContactRecord) =>
    projectIds(contact).filter(
      (id) => !api.items.some((other) => other.id !== contact.id && projectIds(other).includes(id)),
    )

  const remove = async () => {
    if (!selectedId || creating) return
    const current = api.items.find((item) => item.id === selectedId)
    if (!current) return
    const orphans = orphaned(current)
    if (orphans.length && !replacementId) {
      setError('Choose another relationship to cover the projects that would be left without a contact.')
      return
    }
    if (orphans.length && replacementId) {
      const replacement = api.items.find((item) => item.id === replacementId)
      if (replacement) {
        const ids = [...new Set([...projectIds(replacement), ...orphans])]
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
    setSelectedId(null)
    setConfirmDelete(false)
    setReplacementId('')
  }

  const projectLabel = (contact: ContactRecord) => {
    const ids = projectIds(contact)
    const names = ids.map((id) => opportunities.find((opp) => opp.id === id)?.projectName).filter(Boolean)
    if (!names.length) return contact.projectName || '—'
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface px-6 py-5">
        <div>
          <h1 className="font-brand text-2xl font-bold text-navy-900">Relationships</h1>
          <p className="mt-1 text-sm text-ink-muted">People across the book. A contact’s company can differ from the acquisition target.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search relationships" className="h-10 w-56 rounded-lg border border-border bg-canvas pr-3 pl-9 text-sm" />
          </div>
          <button type="button" onClick={startCreate} className="inline-flex h-10 items-center gap-1 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> New Relationship
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border bg-canvas px-6 py-3">
        {['All Relationships', ...CONTACT_STATUSES].map((option) => (
          <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === option ? 'border-navy-900 bg-navy-900 text-white' : 'border-border bg-surface text-ink-muted'}`}>
            {option}
          </button>
        ))}
      </div>
      <div className={selectedId ? 'grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]' : 'min-h-0 flex-1'}>
        <div className="custom-scroll overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                {['Name', 'Company', 'Title', 'Category', 'Project', 'Status', 'Last Contact'].map((label) => (
                  <th key={label} className="px-3 py-3 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((contact) => (
                <tr key={contact.id} onClick={() => requestSelect(contact.id)} className={`cursor-pointer border-t border-border ${selectedId === contact.id ? 'bg-accent-soft' : 'hover:bg-canvas'}`}>
                  <td className="px-3 py-3 font-semibold">{contact.name}</td>
                  <td className="px-3 py-3">{contact.company}</td>
                  <td className="px-3 py-3">{contact.title}</td>
                  <td className="px-3 py-3">{contact.category}</td>
                  <td className="px-3 py-3" title={projectIds(contact).map((id) => opportunities.find((opp) => opp.id === id)?.projectName).filter(Boolean).join(', ')}>{projectLabel(contact)}</td>
                  <td className="px-3 py-3">{contact.status}</td>
                  <td className="px-3 py-3">{contact.lastContactDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedId && (
          <aside className="border-l border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-brand text-lg font-bold">{creating ? 'New Relationship' : draft.name || 'Relationship'}</h2>
              <button type="button" aria-label="Close" onClick={() => {
                const close = () => { setSelectedId(null); setCreating(false) }
                if (dirty) setPendingLeave(() => close)
                else close()
              }}><X className="h-4 w-4" /></button>
            </div>
            {error && <p className="mb-2 text-xs text-attention">{error}</p>}
            <div className="space-y-2">
              {(['name', 'company', 'title', 'email', 'phone'] as const).map((key) => (
                <label key={key} className="block text-[11px] font-semibold text-ink-muted uppercase">
                  {key}
                  <input value={String(draft[key] ?? '')} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm font-normal normal-case" />
                </label>
              ))}
              <label className="block text-[11px] font-semibold text-ink-muted uppercase">
                Category
                <input value={categoryQuery} onChange={(e) => { setCategoryQuery(e.target.value); setDraft((d) => ({ ...d, category: e.target.value.trim() })) }} className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm font-normal normal-case" placeholder="Type to filter or add" />
              </label>
              <div className="flex flex-wrap gap-1">
                {(filteredCategories.length ? filteredCategories : categoryQuery.trim() ? [categoryQuery.trim()] : categories).slice(0, 8).map((category) => (
                  <button key={category} type="button" className="rounded-full border border-border px-2 py-1 text-[11px]" onClick={() => { setDraft((d) => ({ ...d, category })); setCategoryQuery(category) }}>{category}</button>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-ink-muted uppercase">Company</p>
              <SearchSelect
                value={draft.company}
                options={[...new Set(opportunities.map((opp) => opp.entityName).concat(api.items.map((item) => item.company)))].filter(Boolean).map((name) => ({ id: name, label: name }))}
                onChange={(company) => setDraft((d) => ({ ...d, company: company ?? '' }))}
              />
              <p className="text-[11px] font-semibold text-ink-muted uppercase">Projects</p>
              <div className="max-h-28 space-y-1 overflow-auto rounded-lg border border-border p-2">
                {opportunities.map((opp) => {
                  const checked = (draft.opportunityIds ?? []).includes(opp.id)
                  return (
                    <label key={opp.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setDraft((d) => {
                          const ids = new Set(d.opportunityIds ?? [])
                          if (checked) ids.delete(opp.id)
                          else ids.add(opp.id)
                          return { ...d, opportunityIds: [...ids] }
                        })}
                      />
                      {opp.projectName} · {opp.entityName}
                    </label>
                  )
                })}
              </div>
              <label className="block text-[11px] font-semibold text-ink-muted uppercase">
                Status
                <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm font-normal normal-case">
                  {CONTACT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-ink-muted uppercase">
                Last contact
                <input type="date" value={draft.lastContactDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, lastContactDate: e.target.value || null }))} className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm font-normal normal-case" />
              </label>
              <label className="block text-[11px] font-semibold text-ink-muted uppercase">
                Notes
                <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} className="mt-1 min-h-20 w-full rounded-lg border border-border px-2 py-1 text-sm font-normal normal-case" />
              </label>
            </div>
            <button type="button" disabled={!canSave} onClick={() => void save()} className={`mt-3 h-10 w-full rounded-lg text-sm font-semibold ${canSave ? 'bg-navy-900 text-white' : 'border border-border bg-white text-ink-muted'}`}>
              Save Changes
            </button>
            {!creating && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="mt-2 h-10 w-full rounded-lg border border-attention-border text-sm font-semibold text-attention">
                Delete Relationship
              </button>
            )}
          </aside>
        )}
      </div>
      <UnsavedChangesDialog
        open={pendingLeave != null}
        saving={false}
        error={null}
        recordLabel="relationship"
        onSave={() => void save().then(() => { const next = pendingLeave; setPendingLeave(null); next?.() })}
        onDiscard={() => { const next = pendingLeave; setPendingLeave(null); next?.() }}
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
      {confirmDelete && selectedId && (
        <div className="fixed bottom-6 left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 shadow-(--shadow-elevated)">
          <SearchSelect
            value={replacementId}
            placeholder="Replacement contact"
            options={api.items.filter((item) => item.id !== selectedId).map((item) => ({ id: item.id, label: item.name }))}
            onChange={(id) => setReplacementId(id ?? '')}
          />
        </div>
      )}
    </div>
  )
}
