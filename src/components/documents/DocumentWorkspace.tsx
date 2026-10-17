import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Plus, X } from 'lucide-react'
import type { Opportunity } from '@/types'
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_FILE_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentRecord,
} from '@/data/mockModules'
import { useData } from '@/data/DataContext'
import { useAuth } from '@/auth/AuthContext'
import { dealIdFromOpportunity } from '@/lib/dealId'
import {
  customDocumentsForOpportunity,
  DEFAULT_DOCUMENT_SLOTS,
  inferFileType,
  isOpenableDocumentUrl,
  slotDocument,
} from '@/lib/documentSlots'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FileKindIcon, iconKindForDocument } from '@/components/documents/FileKindIcon'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { saveButtonLabel, savedMessageLabel } from '@/lib/persistenceMode'
import { nowIso } from '@/lib/calendarDate'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'

interface DocumentWorkspaceProps {
  opportunity: Opportunity
  onClose: () => void
  initialDocumentId?: string | null
}

type DocDraft = {
  name: string
  docType: string
  fileType: string
  status: string
  confidentiality: string
  link: string
  notes: string
}

function fromRecord(doc: DocumentRecord): DocDraft {
  return {
    name: doc.name,
    docType: doc.docType,
    fileType: doc.fileType || inferFileType(doc),
    status: doc.status,
    confidentiality: doc.confidentiality,
    link: doc.link ?? '',
    notes: doc.notes ?? '',
  }
}

function emptyDraft(docType: string): DocDraft {
  return {
    name: '',
    docType,
    fileType: '',
    status: 'Draft',
    confidentiality: 'Confidential',
    link: '',
    notes: '',
  }
}

export const DocumentWorkspace = forwardRef<OpportunityEditorHandle, DocumentWorkspaceProps>(
  function DocumentWorkspace({ opportunity, onClose, initialDocumentId }, ref) {
    const { documents, createDocument, saveDocument, deleteDocument } = useData()
    const { user } = useAuth()
    const userName = user?.name ?? ''
    const guard = useEditorGuard()
    const related = useMemo(
      () => documents.filter((d) => d.opportunityId === opportunity.id),
      [documents, opportunity.id],
    )
    const [tab, setTab] = useState<string>('NDA')
    const [mode, setMode] = useState<'slot' | 'custom' | 'new'>('slot')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<DocDraft>(() => emptyDraft('NDA'))
    const [saved, setSaved] = useState<DocDraft>(() => emptyDraft('NDA'))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const savingRef = useRef(false)
    const deletingRef = useRef(false)

    const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
    const customDocs = customDocumentsForOpportunity(related, opportunity.id)

    const loadSlot = (slot: string) => {
      const existing = slotDocument(related, opportunity.id, slot)
      const next = existing ? fromRecord(existing) : emptyDraft(slot)
      setTab(slot)
      setMode('slot')
      setEditingId(existing?.id ?? null)
      setDraft(next)
      setSaved(existing ? next : emptyDraft(slot))
      setError(null)
      setMessage(null)
    }

    useEffect(() => {
      if (initialDocumentId) {
        const existing = related.find((doc) => doc.id === initialDocumentId)
        if (existing) {
          setTab(
            (DEFAULT_DOCUMENT_SLOTS as readonly string[]).includes(existing.docType) ||
              existing.docType === 'Teaser / CIM'
              ? existing.docType === 'Teaser / CIM'
                ? 'CIM'
                : existing.docType
              : existing.id,
          )
          setMode(
            (DEFAULT_DOCUMENT_SLOTS as readonly string[]).includes(existing.docType) ||
              existing.docType === 'Teaser / CIM'
              ? 'slot'
              : 'custom',
          )
          setEditingId(existing.id)
          const snap = fromRecord(existing)
          setDraft(snap)
          setSaved(snap)
          return
        }
      }
      loadSlot('NDA')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opportunity.id, initialDocumentId])

    const requestLeave = useCallback(
      (next: () => void) => {
        if (!dirty) {
          next()
          return
        }
        setPendingLeave(() => next)
      },
      [dirty],
    )

    useImperativeHandle(ref, () => ({ isDirty: () => dirty, requestLeave }), [dirty, requestLeave])
    useEffect(() => {
      guard?.register({ isDirty: () => dirty, requestLeave })
      return () => guard?.register(null)
    }, [dirty, requestLeave, guard])

    const persist = async (): Promise<boolean> => {
      if (savingRef.current) return false
      savingRef.current = true
      setSaving(true)
      setError(null)
      try {
        const payload = {
          name: draft.name.trim() || `${opportunity.projectName} ${draft.docType}`,
          docType: draft.docType,
          fileType: draft.fileType,
          status: draft.status,
          confidentiality: draft.confidentiality,
          link: draft.link.trim(),
          notes: draft.notes,
          opportunityId: opportunity.id,
          projectName: opportunity.projectName,
          uploadedBy:
            related.find((doc) => doc.id === editingId)?.uploadedBy || userName || 'Newport user',
          uploadedAt:
            related.find((doc) => doc.id === editingId)?.uploadedAt || nowIso().slice(0, 10),
        }
        const result = editingId
          ? await saveDocument(editingId, payload)
          : await createDocument(payload)
        const snap = fromRecord(result)
        setEditingId(result.id)
        setDraft(snap)
        setSaved(snap)
        setMode(
          (DEFAULT_DOCUMENT_SLOTS as readonly string[]).includes(result.docType) ||
            result.docType === 'Teaser / CIM'
            ? 'slot'
            : 'custom',
        )
        setMessage(savedMessageLabel())
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    }

    const startNew = () => {
      const go = () => {
        setMode('new')
        setEditingId(null)
        const next = emptyDraft('Financials')
        setDraft(next)
        setSaved(emptyDraft('__unsaved__'))
        setMessage(null)
        setError(null)
      }
      requestLeave(go)
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
              {dealIdFromOpportunity(opportunity)}
            </p>
            <h2 className="mt-1 font-brand text-xl font-bold text-navy-900">
              {opportunity.projectName}
            </h2>
            <p className="text-sm text-ink-muted">{opportunity.entityName}</p>
          </div>
          <button
            type="button"
            onClick={() => requestLeave(onClose)}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
            aria-label="Close document workspace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 flex-wrap gap-1 border-b border-border px-2 pt-2">
          {DEFAULT_DOCUMENT_SLOTS.map((slot) => {
            const doc = slotDocument(related, opportunity.id, slot)
            const icon = iconKindForDocument(doc)
            return (
              <button
                key={slot}
                type="button"
                onClick={() => requestLeave(() => loadSlot(slot))}
                className={`inline-flex items-center gap-1 rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  tab === slot && mode === 'slot'
                    ? 'bg-accent-soft text-navy-900'
                    : 'text-ink-muted hover:bg-canvas'
                }`}
              >
                {slot}
                <FileKindIcon missing={icon.missing} kind={icon.kind} />
              </button>
            )
          })}
          {customDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() =>
                requestLeave(() => {
                  setTab(doc.id)
                  setMode('custom')
                  setEditingId(doc.id)
                  const snap = fromRecord(doc)
                  setDraft(snap)
                  setSaved(snap)
                })
              }
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
                editingId === doc.id && mode === 'custom'
                  ? 'bg-accent-soft text-navy-900'
                  : 'text-ink-muted hover:bg-canvas'
              }`}
            >
              {doc.docType}
            </button>
          ))}
          <button
            type="button"
            onClick={startNew}
            className="ml-auto mb-1 mr-2 inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Document
          </button>
        </div>

        <div className="custom-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Name
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          {isOpenableDocumentUrl(draft.link) ? (
            <a
              href={draft.link.trim()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <ExternalLink className="h-4 w-4" />
              Open Document
            </a>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-canvas px-3 py-3">
              <p className="text-sm font-medium text-ink">No document attached</p>
              <p className="mt-1 text-xs text-ink-subtle">
                Add an authorized https link below, then save. Files are not uploaded here.
              </p>
            </div>
          )}
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Type
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.docType}
              onChange={(e) => setDraft((p) => ({ ...p, docType: e.target.value }))}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Status
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.status}
              onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
            >
              {DOCUMENT_STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Confidentiality
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.confidentiality}
              onChange={(e) => setDraft((p) => ({ ...p, confidentiality: e.target.value }))}
            >
              {CONFIDENTIALITY_LEVELS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <p className="text-xs text-ink-muted">
            Added by{' '}
            {related.find((doc) => doc.id === editingId)?.uploadedBy || userName || '—'} · Added on{' '}
            {related.find((doc) => doc.id === editingId)?.uploadedAt ||
              related.find((doc) => doc.id === editingId)?.createdAt ||
              'unsaved'}
          </p>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Linked opportunity
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm font-normal text-ink-muted"
              value={`${opportunity.projectName} (${dealIdFromOpportunity(opportunity)})`}
              readOnly
            />
          </label>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            File type
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.fileType}
              onChange={(e) => setDraft((p) => ({ ...p, fileType: e.target.value }))}
            >
              <option value="">Not specified</option>
              {DOCUMENT_FILE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Secure document URL (external)
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.link}
              placeholder="https://…"
              onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))}
            />
          </label>
          <p className="text-xs text-ink-subtle">
            The CRM stores a reference only. Files are not uploaded to this public demo.
          </p>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal text-ink"
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
        </div>

        <div className="border-t border-border bg-canvas px-5 py-3">
          {error && <p className="mb-2 text-xs text-attention">{error}</p>}
          {message && <p className="mb-2 text-xs text-success">{message}</p>}
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => void persist()}
            className="h-10 w-full rounded-lg bg-navy-900 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {saveButtonLabel(saving)}
          </button>
          {editingId && mode !== 'new' && (
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => setConfirmDelete(true)}
              className="mt-2 h-10 w-full rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-sm font-semibold text-[var(--color-danger)] disabled:opacity-60"
            >
              Delete Document
            </button>
          )}
        </div>

        <UnsavedChangesDialog
          open={pendingLeave != null}
          saving={saving}
          error={error}
          recordLabel="document"
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
            next?.()
          }}
          onCancel={() => setPendingLeave(null)}
        />

        <ConfirmDialog
          open={confirmDelete}
          title="Delete Document?"
          message="Are you sure you want to remove this document from the CRM? The external file is not deleted."
          confirmLabel="Delete Document"
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setConfirmDelete(false)
          }}
          onConfirm={() => {
            if (!editingId || deletingRef.current) return
            deletingRef.current = true
            setDeleting(true)
            void deleteDocument(editingId)
              .then(() => {
                setConfirmDelete(false)
                setDeleting(false)
                deletingRef.current = false
                loadSlot('NDA')
              })
              .catch((err) => {
                deletingRef.current = false
                setDeleting(false)
                setError(err instanceof Error ? err.message : 'Delete failed')
              })
          }}
        />
      </div>
    )
  },
)
