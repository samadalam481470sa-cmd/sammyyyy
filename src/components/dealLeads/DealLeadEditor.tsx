import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useData } from '@/data/DataContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { MultiSearchSelect } from '@/components/shared/MultiSearchSelect'
import { DrawerHeader, InitialsAvatar, ModalHeader } from '@/components/shared/Overlay'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import type { DealLeadsApi } from '@/hooks/useDealLeads'
import { dealIdFromOpportunity } from '@/lib/dealId'
import { emailConflict, isValidLeadEmail, leadLinkChanges, leadLinks, leadPermissions, UNASSIGNED_LEAD, type DealLead } from '@/lib/dealLeads'
import { saveButtonLabel, savedMessageLabel } from '@/lib/persistenceMode'

export type DealLeadEditorMode =
  /** Admin adding someone. */
  | 'create'
  /** The signed-in person adding themselves. The record links to their Microsoft account. */
  | 'self'
  | 'edit'

interface Draft {
  name: string
  jobTitle: string
  email: string
  phone: string
  status: DealLead['status']
  projectIds: string[]
}

interface Props {
  roster: DealLeadsApi
  mode: DealLeadEditorMode
  lead: DealLead | null
  onClose: () => void
  onSaved?: (lead: DealLead) => void
  footerExtra?: ReactNode
}

const label = 'block text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase'
const input = 'mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink normal-case outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-canvas disabled:text-ink-muted'
const fieldError = 'mt-1 block text-xs font-medium tracking-normal text-attention normal-case'

export const DealLeadEditor = forwardRef<OpportunityEditorHandle, Props>(function DealLeadEditor({ roster, mode, lead, onClose, onSaved, footerExtra }, ref) {
  const { user } = useAuth()
  const { opportunities, saveOpportunity, syncLeadName, logLeadActivity } = useData()
  const guard = useEditorGuard()
  const { api, leads, isAdmin } = roster
  const links = useMemo(() => (lead ? leadLinks(opportunities, lead.id) : []), [opportunities, lead])

  const start = useMemo<Draft>(() => {
    if (lead) return { name: lead.name, jobTitle: lead.jobTitle, email: lead.email, phone: lead.phone, status: lead.status, projectIds: links.map((row) => row.opportunity.id) }
    if (mode === 'self') return { name: user?.name ?? '', jobTitle: '', email: user?.email ?? '', phone: '', status: 'Active', projectIds: [] }
    return { name: '', jobTitle: '', email: '', phone: '', status: 'Active', projectIds: [] }
    // A new baseline only when another record opens; saved links update it after each save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, mode])
  const [baseline, setBaseline] = useState(start)
  const [draft, setDraft] = useState(start)
  const [replacements, setReplacements] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    setBaseline(start)
    setDraft(start)
    setReplacements({})
    setShowErrors(false)
    setError(null)
    setMessage(null)
  }, [start])

  const creating = mode !== 'edit'
  const perms = leadPermissions(lead, user, isAdmin)
  // A linked self record is the person's own even when it was claimed from the roster.
  const canEditProfile = creating ? isAdmin || mode === 'self' : perms.canEditProfile
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || Object.keys(replacements).length > 0
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const requestLeave = useCallback((next: () => void) => {
    if (savingRef.current) return
    if (!dirtyRef.current) return next()
    setPendingLeave(() => next)
  }, [])
  useImperativeHandle(ref, () => ({ isDirty: () => dirtyRef.current, requestLeave }), [requestLeave])
  useEffect(() => {
    guard?.register({ isDirty: () => dirtyRef.current, requestLeave })
    return () => guard?.register(null)
  }, [guard, requestLeave])

  const projectOptions = useMemo(
    () => [...opportunities].sort((a, b) => (a.projectNumber ?? 0) - (b.projectNumber ?? 0)).map((o) => ({ id: o.id, label: o.projectName, detail: `${dealIdFromOpportunity(o)} · ${o.entityName}` })),
    [opportunities],
  )
  const removedPrimaries = links.filter((row) => row.role === 'primary' && !draft.projectIds.includes(row.opportunity.id))

  const conflict = emailConflict(leads, draft.email, lead?.id ?? null)
  const problems = {
    name: draft.name.trim() ? null : 'Enter a full name.',
    // Older records (Mary, Dennis) can have no email yet, so only a changed or new email is checked.
    email: !draft.email.trim() ? (creating || baseline.email ? 'Enter a contact email.' : null) : !isValidLeadEmail(draft.email) ? 'Enter a valid email address.' : conflict ? `That email already belongs to ${conflict.name}.` : null,
    replacements: removedPrimaries.some((row) => !replacements[row.opportunity.id]) ? 'Choose a new primary lead, or Unassigned, for each deal below.' : null,
  }
  const valid = !problems.name && !problems.email && !problems.replacements
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setMessage(null)
  }

  const persist = async (statusOverride?: DealLead['status']): Promise<boolean> => {
    if (savingRef.current) return false
    if (!valid) {
      setShowErrors(true)
      return false
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const stamp = new Date().toISOString()
      const status = statusOverride ?? draft.status
      const fields = { name: draft.name.trim(), jobTitle: draft.jobTitle.trim(), email: draft.email.trim(), phone: draft.phone.trim(), status, updatedAt: stamp }
      const linkAccount = mode === 'self' && user?.id ? { authAccountId: user.id } : {}
      let result: DealLead
      if (lead) {
        result = canEditProfile ? await api.save(lead.id, { ...fields, ...linkAccount }) : lead
      } else {
        result = await api.create({ ...fields, authAccountId: mode === 'self' ? (user?.id ?? null) : null, createdAt: stamp })
      }
      if (lead && canEditProfile && result.name !== lead.name) syncLeadName(result.id, result.name)
      const nextRoster = lead ? leads.map((row) => (row.id === result.id ? result : row)) : [result, ...leads]
      const { changes } = leadLinkChanges(opportunities, result, draft.projectIds, replacements, nextRoster)
      for (const change of changes) await saveOpportunity(change.opportunityId, change.patch)
      if (creating) logLeadActivity(`added ${result.name} to the Deal Leads roster`, result)
      else if (statusOverride) logLeadActivity(`${statusOverride === 'Inactive' ? 'deactivated' : 'reactivated'} deal lead ${result.name}`, result)
      else if (canEditProfile && JSON.stringify({ ...baseline, projectIds: [] }) !== JSON.stringify({ ...draft, projectIds: [] })) logLeadActivity(`updated deal lead ${result.name}`, result)
      const snap: Draft = { name: result.name, jobTitle: result.jobTitle, email: result.email, phone: result.phone, status: result.status, projectIds: draft.projectIds }
      setBaseline(snap)
      setDraft(snap)
      setReplacements({})
      setShowErrors(false)
      dirtyRef.current = false
      setMessage(savedMessageLabel())
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

  const canSave = dirty && !saving
  const newPrimaryOptions = [{ id: UNASSIGNED_LEAD, label: 'Unassigned' }, ...leads.filter((row) => row.status === 'Active' && row.id !== lead?.id).map((row) => ({ id: row.id, label: row.name }))]

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="deal-lead-editor">
      {creating ? (
        <ModalHeader
          eyebrow="Unsaved draft"
          title={mode === 'self' ? 'Add Myself as Deal Lead' : 'New Deal Lead'}
          subtitle={mode === 'self' ? 'This record links to the Microsoft account you are signed in with.' : 'Nothing is created until you save.'}
          onClose={() => requestLeave(onClose)}
          closeLabel="Close deal lead form"
        />
      ) : (
        <DrawerHeader eyebrow={perms.isOwn ? 'My Deal Lead Profile' : 'Deal Lead'} title={draft.name.trim() || 'Deal Lead'} subtitle={draft.jobTitle || undefined} onClose={() => requestLeave(onClose)} closeLabel="Close deal lead editor">
          <div className="flex items-center gap-2">
            <InitialsAvatar name={draft.name} tone="light" size="md" />
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${draft.status === 'Active' ? 'bg-[#e6f4ec] text-[#1f6b4a]' : 'bg-[#eef0f3] text-[#5a6577]'}`} data-testid="deal-lead-status-chip">{draft.status}</span>
            <span className="text-xs text-white/75">{links.length} linked opportunit{links.length === 1 ? 'y' : 'ies'}</span>
          </div>
        </DrawerHeader>
      )}

      <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {!creating && !canEditProfile && (
          <p className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-ink-muted" data-testid="deal-lead-readonly-note">
            You can view this profile but not change it. Only this person or an administrator can. Deal assignments below follow normal opportunity editing.
          </p>
        )}
        <label className={label}>
          Full Name *
          <input data-testid="deal-lead-name" value={draft.name} disabled={!canEditProfile} onChange={(e) => set('name', e.target.value)} className={input} />
          {showErrors && problems.name && <span className={fieldError} data-testid="deal-lead-name-error">{problems.name}</span>}
        </label>
        <label className={label}>
          Job Title
          <input data-testid="deal-lead-title" value={draft.jobTitle} disabled={!canEditProfile} onChange={(e) => set('jobTitle', e.target.value)} className={input} />
        </label>
        <label className={label}>
          Contact Email{creating || baseline.email ? ' *' : ''}
          <input data-testid="deal-lead-email" type="email" value={draft.email} disabled={!canEditProfile} onChange={(e) => set('email', e.target.value)} className={input} />
          {showErrors && problems.email && <span className={fieldError} data-testid="deal-lead-email-error">{problems.email}</span>}
          {!creating && !draft.email.trim() && canEditProfile && <span className="mt-1 block text-[11px] font-normal tracking-normal text-ink-muted normal-case">No contact email is saved yet.</span>}
          {(mode === 'self' || perms.isOwn) && <span className="mt-1 block text-[11px] font-normal tracking-normal text-ink-muted normal-case">This is only your contact email. Your Microsoft sign-in does not change.</span>}
        </label>
        <label className={label}>
          Phone
          <input data-testid="deal-lead-phone" value={draft.phone} disabled={!canEditProfile} onChange={(e) => set('phone', e.target.value)} className={input} />
        </label>
        {!creating && perms.canChangeStatus && (
          <div>
            <span className={label}>Status</span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{draft.status}</span>
              {draft.status === 'Active' ? (
                <button type="button" onClick={() => setConfirmDeactivate(true)} className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink hover:bg-canvas" data-testid="deal-lead-deactivate">Deactivate</button>
              ) : (
                <button type="button" disabled={saving} onClick={() => void persist('Active')} className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-ink hover:bg-canvas" data-testid="deal-lead-reactivate">Reactivate</button>
              )}
            </div>
          </div>
        )}
        <div>
          <span className={label}>Linked Opportunities</span>
          <MultiSearchSelect testId="deal-lead-projects" values={draft.projectIds} options={projectOptions} onChange={(ids) => set('projectIds', ids)} placeholder="Search projects" emptyText="No matching projects" />
          {links.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-muted" data-testid="deal-lead-roles">
              {links.filter((row) => draft.projectIds.includes(row.opportunity.id)).map((row) => (
                <li key={row.opportunity.id} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={row.opportunity.projectName}>{row.opportunity.projectName}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.role === 'primary' ? 'bg-navy-900 text-white' : 'bg-canvas text-ink-muted'}`}>{row.role === 'primary' ? 'Primary' : 'Additional'}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-ink-muted">Added here as an additional lead, or as primary when the deal has none. Primary and additional leads are set on the opportunity too; both places change the same assignment.</p>
        </div>
        {removedPrimaries.length > 0 && (
          <div className="rounded-lg border border-[#f0e2bd] bg-[#fdf7e7] p-3" data-testid="primary-replacements">
            <p className="text-xs font-semibold text-[#7a5c1e]">{draft.name.trim() || 'This lead'} is the primary lead on these deals. Choose who takes over, or choose Unassigned.</p>
            {removedPrimaries.map((row) => (
              <div key={row.opportunity.id} className="mt-2">
                <span className="text-xs font-semibold text-ink">{row.opportunity.projectName}</span>
                <SearchSelect value={replacements[row.opportunity.id] ?? null} options={newPrimaryOptions} onChange={(id) => setReplacements((prev) => ({ ...prev, [row.opportunity.id]: id ?? UNASSIGNED_LEAD }))} placeholder="Choose the new primary" />
              </div>
            ))}
            {showErrors && problems.replacements && <p className="mt-2 text-xs font-medium text-attention" data-testid="primary-replacements-error">{problems.replacements}</p>}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border bg-surface px-5 py-3">
        {error && <p className="text-xs text-attention">{error}</p>}
        {message && !dirty && <p className="text-xs text-success">{message}</p>}
        <button type="button" data-testid="deal-lead-save" disabled={!canSave} onClick={() => void persist()} className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'}`}>
          {saveButtonLabel(saving)}
        </button>
        {footerExtra}
      </div>

      <UnsavedChangesDialog
        open={pendingLeave != null}
        saving={saving}
        error={error}
        recordLabel="deal lead"
        onSave={() =>
          void persist().then((ok) => {
            if (!ok) {
              setPendingLeave(null)
              return
            }
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
        open={confirmDeactivate}
        title="Deactivate this deal lead?"
        message={`${draft.name} stays on past and current deals and in reports, and can be reactivated later. They will not be offered for new assignments.`}
        confirmLabel="Deactivate"
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => {
          setConfirmDeactivate(false)
          void persist('Inactive')
        }}
      />
    </div>
  )
})
