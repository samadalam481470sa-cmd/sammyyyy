import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CenteredModal, ModalHeader } from '@/components/shared/Overlay'
import type { Opportunity } from '@/types'
import {
  ACQUISITION_STAGES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  SOURCE_TYPES,
} from '@/data/constants'
import { useData } from '@/data/DataContext'
import { formatDealId, nextProjectNumber } from '@/lib/dealId'
import { savedMessageLabel, saveButtonLabel } from '@/lib/persistenceMode'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'

interface OpportunityCreateFormProps {
  open: boolean
  onClose: () => void
  onCreated?: (opportunity: Opportunity) => void
}

interface CreateDraft {
  projectName: string
  entityName: string
  status: Opportunity['status']
  stage: Opportunity['stage']
  dealLead: string
  type: Opportunity['type']
  sourceType: Opportunity['sourceType']
  sourceName: string
  nwp: string
  netRevenue: string
  pfEbitda: string
  nextAction: string
  nextActionDate: string
  priority: Opportunity['priority']
  diligenceNotes: string
  closedAt: string
}

const EMPTY: CreateDraft = {
  projectName: '',
  entityName: '',
  status: 'Pending',
  stage: 'Target Identified',
  dealLead: '',
  type: 'Platform Acquisition',
  sourceType: 'Other',
  sourceName: '',
  nwp: '',
  netRevenue: '',
  pfEbitda: '',
  nextAction: '',
  nextActionDate: '',
  priority: 'B',
  diligenceNotes: '',
  closedAt: '',
}

function isDirty(draft: CreateDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(EMPTY)
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function OpportunityCreateForm({ open, onClose, onCreated }: OpportunityCreateFormProps) {
  const { opportunities, createOpportunity, users } = useData()
  const [draft, setDraft] = useState<CreateDraft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
  const savingRef = useRef(false)

  const dealPreview = formatDealId(nextProjectNumber(opportunities))

  useEffect(() => {
    if (!open) return
    setDraft(EMPTY)
    setError(null)
    setMessage(null)
    setPendingLeave(null)
    savingRef.current = false
    setSaving(false)
  }, [open])

  const ownerOptions = useMemo(
    () => users.map((row) => ({ id: row.name, label: row.name })),
    [users],
  )

  const requestClose = () => {
    if (savingRef.current) return
    if (!isDirty(draft)) {
      onClose()
      return
    }
    setPendingLeave(() => onClose)
  }

  const persist = async (): Promise<boolean> => {
    if (savingRef.current) return false
    if (!draft.projectName.trim() || !draft.entityName.trim()) {
      setError('Project name and entity are required')
      return false
    }
    if (draft.status === 'Completed' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.closedAt)) {
      setError('Completed means legally closed. Enter the legal closing date.')
      return false
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const created = await createOpportunity({
        projectName: draft.projectName.trim(),
        entityName: draft.entityName.trim(),
        status: draft.status,
        stage: draft.stage,
        dealLead: draft.dealLead,
        type: draft.type,
        sourceType: draft.sourceType,
        sourceName: draft.sourceName.trim(),
        nwp: toNumber(draft.nwp),
        netRevenue: toNumber(draft.netRevenue),
        pfEbitda: toNumber(draft.pfEbitda),
        nextAction: draft.nextAction.trim() || null,
        nextActionDate: draft.nextActionDate || null,
        priority: draft.priority,
        diligenceNotes: draft.diligenceNotes.trim(),
        closedAt: draft.status === 'Completed' ? draft.closedAt : null,
      })
      setMessage(savedMessageLabel())
      onCreated?.(created)
      setDraft(EMPTY)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (!open) return null

  const setField = <K extends keyof CreateDraft>(key: K, value: CreateDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setMessage(null)
  }

  return (
    <CenteredModal open={open} onRequestClose={requestClose} label="New Opportunity" width="max-w-2xl" testId="new-opportunity-modal">
        <ModalHeader eyebrow={dealPreview} title="New Opportunity" subtitle="Unsaved draft — nothing is created until you save." onClose={requestClose} closeLabel="Close new opportunity form" />

        <div className="custom-scroll grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto px-6 py-4 sm:grid-cols-2">
          <Field label="Deal ID">
            <input className="field-input" value={dealPreview} readOnly />
          </Field>
          <Field label="Project name" required>
            <input
              className="field-input"
              value={draft.projectName}
              onChange={(e) => setField('projectName', e.target.value)}
            />
          </Field>
          <Field label="Company Name" required>
            <input
              className="field-input"
              value={draft.entityName}
              onChange={(e) => setField('entityName', e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              className="field-input"
              value={draft.status}
              onChange={(e) => {
                const status = e.target.value as Opportunity['status']
                setDraft((prev) => ({ ...prev, status, stage: status === 'Completed' ? 'Closing' : prev.stage }))
                setError(null)
              }}
            >
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          {draft.status === 'Completed' && (
            <Field label="Legal closing date" required>
              <input type="date" className="field-input" max={new Date().toISOString().slice(0, 10)} value={draft.closedAt} onChange={(e) => setField('closedAt', e.target.value)} />
              <span className="mt-1 block text-[11px] text-ink-muted">Completed means legally closed. The stage is set to Closing.</span>
            </Field>
          )}
          <Field label="Acquisition Stage">
            <select
              className="field-input"
              value={draft.stage}
              onChange={(e) => setField('stage', e.target.value as Opportunity['stage'])}
            >
              {ACQUISITION_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Deal Lead">
            <SearchSelect
              value={draft.dealLead || null}
              options={ownerOptions}
              onChange={(id) => setField('dealLead', id ?? '')}
              placeholder="Select an authorized user"
              emptyText="No matching users"
            />
          </Field>
          <Field label="Acquisition type">
            <select
              className="field-input"
              value={draft.type}
              onChange={(e) => setField('type', e.target.value as Opportunity['type'])}
            >
              {OPPORTUNITY_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Source type">
            <select
              className="field-input"
              value={draft.sourceType}
              onChange={(e) => setField('sourceType', e.target.value as Opportunity['sourceType'])}
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Source name">
            <input
              className="field-input"
              value={draft.sourceName}
              onChange={(e) => setField('sourceName', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="NWP">
              <input
                type="number"
                className="field-input"
                value={draft.nwp}
                onChange={(e) => setField('nwp', e.target.value)}
              />
            </Field>
            <Field label="Net Revenue">
              <input
                type="number"
                className="field-input"
                value={draft.netRevenue}
                onChange={(e) => setField('netRevenue', e.target.value)}
              />
            </Field>
            <Field label="PF EBITDA">
              <input
                type="number"
                className="field-input"
                value={draft.pfEbitda}
                onChange={(e) => setField('pfEbitda', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Next action">
            <input
              className="field-input"
              value={draft.nextAction}
              onChange={(e) => setField('nextAction', e.target.value)}
            />
          </Field>
          <Field label="Next action date">
            <input
              type="date"
              className="field-input"
              value={draft.nextActionDate}
              onChange={(e) => setField('nextActionDate', e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <select
              className="field-input"
              value={draft.priority}
              onChange={(e) => setField('priority', e.target.value as Opportunity['priority'])}
            >
              <option value="A">A — Must move this week</option>
              <option value="B">B — Important but can wait</option>
              <option value="C">C — Monitor only</option>
            </select>
          </Field>
          <Field label="Notes" wide>
            <textarea
              className="field-input min-h-24"
              value={draft.diligenceNotes}
              onChange={(e) => setField('diligenceNotes', e.target.value)}
            />
          </Field>
        </div>

        <div className="border-t border-border bg-canvas px-5 py-3">
          {error && <p className="mb-2 text-xs text-attention">{error}</p>}
          {message && <p className="mb-2 text-xs text-success">{message}</p>}
          <button
            type="button"
            disabled={saving || !draft.projectName.trim() || !draft.entityName.trim()}
            onClick={() =>
              void persist().then((ok) => {
                if (ok) onClose()
              })
            }
            className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${
              draft.projectName.trim() && draft.entityName.trim() && !saving
                ? 'bg-navy-900 text-white hover:bg-navy-800'
                : 'border border-border bg-white text-ink-muted'
            }`}
          >
            {saveButtonLabel(saving)}
          </button>
        </div>

        <UnsavedChangesDialog
          open={pendingLeave != null}
          saving={saving}
          error={error}
          recordLabel="new opportunity"
          onSave={() => {
            void persist().then((ok) => {
              if (!ok) return
              const next = pendingLeave
              setPendingLeave(null)
              next?.()
            })
          }}
          onDiscard={() => {
            const next = pendingLeave
            setPendingLeave(null)
            setDraft(EMPTY)
            next?.()
          }}
          onCancel={() => setPendingLeave(null)}
        />

        <style>{`
          .field-input {
            margin-top: 0.35rem;
            width: 100%;
            height: 2.5rem;
            border-radius: 0.5rem;
            border: 1px solid var(--color-border);
            background: white;
            padding: 0 0.75rem;
            font-size: 0.875rem;
            outline: none;
          }
          textarea.field-input { height: auto; padding: 0.6rem 0.75rem; }
          .field-input:focus {
            border-color: var(--color-accent);
            box-shadow: 0 0 0 2px rgb(61 126 184 / 0.2);
          }
        `}</style>
    </CenteredModal>
  )
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}
