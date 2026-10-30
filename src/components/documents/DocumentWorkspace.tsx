import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Plus, X } from 'lucide-react'
import type { Opportunity } from '@/types'
import {
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_FILE_TYPES,
  DOCUMENT_STATUSES,
  type DocumentRecord,
} from '@/data/mockModules'
import { useData } from '@/data/DataContext'
import { useAuth } from '@/auth/AuthContext'
import { dealIdFromOpportunity } from '@/lib/dealId'
import {
  customDocumentsForOpportunity,
  DOCUMENT_SLOT_META,
  fileTypeFromFileName,
  hasAttachedFile,
  inferFileType,
  isDefaultDocumentSlot,
  isOpenableDocumentUrl,
  normalizeDocSlot,
  slotAbbreviation,
  slotDocument,
} from '@/lib/documentSlots'
import { deleteDocumentBlob, getDocumentBlob, putDocumentBlob } from '@/lib/documentFileStore'
import { uploadDealDocumentToOneDrive } from '@/lib/graphDocuments'
import { sessionOwnerKey } from '@/lib/ownerKey'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CreatableSelect, matchExistingOption } from '@/components/shared/CreatableSelect'
import { rememberCustomType, storedCustomTypes } from '@/lib/documentTypes'
import { deleteWorkspaceFile, downloadWorkspaceFile, isWorkspaceShared, uploadWorkspaceFile } from '@/lib/workspaceSync'
import { FileAttachmentField } from '@/components/documents/FileAttachmentField'
import { SlotPresenceIcon } from '@/components/documents/SlotPresenceIcon'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { saveButtonLabel, savedMessageLabel } from '@/lib/persistenceMode'
import { todayDateInput } from '@/lib/calendarDate'
import { useEditorGuard, type OpportunityEditorHandle } from '@/components/shared/EditorGuardContext'
import { registerPendingCommit } from '@/lib/userVault'

interface DocumentWorkspaceProps {
  opportunity: Opportunity
  onClose: () => void
  initialDocumentId?: string | null
  /** Told when "Add New Document" creation starts or ends, so the page can dim behind it. */
  onCreatingChange?: (creating: boolean) => void
  /** Increment to ask the workspace to leave creation (backdrop click / Escape); unsaved work is confirmed first. */
  cancelCreateRequest?: number
  /** Shown at the very bottom, below Delete Document when it exists. */
  footerExtra?: ReactNode
}


type DocDraft = {
  name: string
  docType: string
  fileType: string
  status: string
  confidentiality: string
  link: string
  notes: string
  fileName: string
  fileSize: number
  storage: DocumentRecord['storage']
  webUrl: string
  driveItemId: string
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
    fileName: doc.fileName ?? '',
    fileSize: doc.fileSize ?? 0,
    storage: doc.storage,
    webUrl: doc.webUrl ?? '',
    driveItemId: doc.driveItemId ?? '',
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
    fileName: '',
    fileSize: 0,
    storage: 'none',
    webUrl: '',
    driveItemId: '',
  }
}

export const DocumentWorkspace = forwardRef<OpportunityEditorHandle, DocumentWorkspaceProps>(
  function DocumentWorkspace({ opportunity, onClose, initialDocumentId, onCreatingChange, cancelCreateRequest, footerExtra }, ref) {
    const { documents, createDocument, saveDocument, deleteDocument } = useData()
    const { user } = useAuth()
    const owner = sessionOwnerKey(user)
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
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const savingRef = useRef(false)
    const deletingRef = useRef(false)
    const pendingFileRef = useRef<File | null>(null)
    pendingFileRef.current = pendingFile

    const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || pendingFile != null
    const typeText = draft.docType.trim()
    const typeProblem =
      mode === 'slot'
        ? null
        : !typeText
          ? 'Enter a document type.'
          : isDefaultDocumentSlot(typeText)
            ? `${normalizeDocSlot(typeText)} has its own slot tab. Use that tab, or enter a more specific type.`
            : null
    const canSave = dirty && !typeProblem && !saving && !deleting
    const dirtyRef = useRef(dirty)
    dirtyRef.current = dirty
    const customDocs = customDocumentsForOpportunity(related, opportunity.id)
    const knownCustomTypes = useMemo(
      () => [...documents.map((doc) => doc.docType).filter((type) => type && !isDefaultDocumentSlot(type)), ...storedCustomTypes()],
      [documents],
    )
    const onCreatingRef = useRef(onCreatingChange)
    onCreatingRef.current = onCreatingChange
    useEffect(() => {
      onCreatingRef.current?.(mode === 'new')
    }, [mode])
    useEffect(() => () => onCreatingRef.current?.(false), [])
    const dealId = dealIdFromOpportunity(opportunity)

    const loadSlot = (slot: string) => {
      const existing = slotDocument(related, opportunity.id, slot)
      const next = existing ? fromRecord(existing) : emptyDraft(slot)
      setTab(slot)
      setMode('slot')
      setEditingId(existing?.id ?? null)
      setDraft(next)
      setSaved(existing ? next : emptyDraft(slot))
      setPendingFile(null)
      setError(null)
      setMessage(null)
    }

    useEffect(() => {
      if (initialDocumentId) {
        const existing = related.find((doc) => doc.id === initialDocumentId)
        if (existing) {
          const defaultSlot = isDefaultDocumentSlot(existing.docType)
          setTab(defaultSlot ? normalizeOrId(existing) : existing.id)
          setMode(defaultSlot ? 'slot' : 'custom')
          setEditingId(existing.id)
          const snap = fromRecord(existing)
          setDraft(snap)
          setSaved(snap)
          setPendingFile(null)
          return
        }
      }
      loadSlot('NDA')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opportunity.id, initialDocumentId])

    const requestLeave = useCallback((next: () => void) => {
      if (savingRef.current) return
      if (!dirtyRef.current) {
        next()
        return
      }
      setPendingLeave(() => next)
    }, [])

    useImperativeHandle(ref, () => ({ isDirty: () => dirtyRef.current, requestLeave }), [requestLeave])
    const lastCancel = useRef(cancelCreateRequest ?? 0)
    useEffect(() => {
      if (cancelCreateRequest == null || cancelCreateRequest === lastCancel.current) return
      lastCancel.current = cancelCreateRequest
      if (mode === 'new') requestLeave(() => loadSlot('NDA'))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancelCreateRequest])
    useEffect(() => {
      guard?.register({ isDirty: () => dirtyRef.current, requestLeave })
      return () => guard?.register(null)
    }, [requestLeave, guard])

    const persist = async (): Promise<boolean> => {
      if (savingRef.current) return false
      savingRef.current = true
      setSaving(true)
      setError(null)
      try {
        let nextEditingId = editingId
        if (!nextEditingId && isDefaultDocumentSlot(draft.docType)) {
          nextEditingId = slotDocument(related, opportunity.id, draft.docType)?.id ?? null
        }
        const attachedName = pendingFile?.name || draft.fileName
        const attachedSize = pendingFile?.size ?? draft.fileSize
        let storage: DocumentRecord['storage'] = draft.storage
        if (pendingFile) storage = 'local'
        else if (isOpenableDocumentUrl(draft.webUrl)) storage = 'onedrive'
        else if (isOpenableDocumentUrl(draft.link)) storage = 'url'
        else if (!attachedName) storage = 'none'

        const docType = mode === 'slot' ? draft.docType : matchExistingOption(draft.docType, knownCustomTypes)
        if (mode !== 'slot') rememberCustomType(docType)
        const payload: Partial<DocumentRecord> = {
          name: draft.name.trim() || `${opportunity.projectName} ${docType}`,
          docType,
          fileType: pendingFile ? fileTypeFromFileName(pendingFile.name) : draft.fileType,
          status: draft.status,
          confidentiality: draft.confidentiality,
          link: draft.link.trim(),
          notes: draft.notes,
          opportunityId: opportunity.id,
          projectName: opportunity.projectName,
          uploadedBy:
            related.find((doc) => doc.id === nextEditingId)?.uploadedBy || userName || 'Newport user',
          uploadedAt:
            related.find((doc) => doc.id === nextEditingId)?.uploadedAt || todayDateInput(),
          fileName: attachedName,
          fileSize: attachedSize,
          storage,
          webUrl: draft.webUrl,
          driveItemId: draft.driveItemId,
        }
        let result = nextEditingId
          ? await saveDocument(nextEditingId, payload)
          : await createDocument(payload)

        if (pendingFile) {
          await putDocumentBlob(owner, result.id, pendingFile)
          // Shared workspace: store the file on the server so every approved user can open it.
          if (isWorkspaceShared()) await uploadWorkspaceFile(result.id, pendingFile, pendingFile.name)
          const cloud = await uploadDealDocumentToOneDrive({
            file: pendingFile,
            dealId,
            slot: result.docType,
          })
          if (cloud) {
            result = await saveDocument(result.id, {
              storage: 'onedrive',
              webUrl: cloud.webUrl,
              driveItemId: cloud.id,
              fileName: cloud.name,
              fileSize: pendingFile.size,
            })
          }
        }

        const snap = fromRecord(result)
        pendingFileRef.current = null
        dirtyRef.current = false
        setEditingId(result.id)
        setDraft(snap)
        setSaved(snap)
        setPendingFile(null)
        setMode(isDefaultDocumentSlot(result.docType) ? 'slot' : 'custom')
        if (isDefaultDocumentSlot(result.docType)) setTab(normalizeOrId(result))
        else setTab(result.id)
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

    const persistRef = useRef(persist)
    persistRef.current = persist
    useEffect(() => {
      return registerPendingCommit(async () => {
        if (!dirtyRef.current) return
        await persistRef.current()
      })
    }, [])

    const startNew = () => {
      const go = () => {
        setMode('new')
        setEditingId(null)
        setTab('new')
        // Untouched new form: nothing to save until the user enters a type or details.
        const next = emptyDraft('')
        setDraft(next)
        setSaved(next)
        setPendingFile(null)
        setMessage(null)
        setError(null)
      }
      requestLeave(go)
    }

    const openAttached = async () => {
      const href = draft.webUrl.trim() || draft.link.trim()
      if (isOpenableDocumentUrl(href)) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }
      let blob: Blob | null = pendingFile ?? (editingId ? await getDocumentBlob(owner, editingId) : null)
      if (!blob && editingId && isWorkspaceShared()) blob = await downloadWorkspaceFile(editingId)
      if (!blob) {
        setError('No file is available to open yet.')
        return
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }

    const available = hasAttachedFile({
      ...draft,
      id: editingId ?? 'draft',
      opportunityId: opportunity.id,
      projectName: opportunity.projectName,
      uploadedBy: userName,
      uploadedAt: '',
    } as DocumentRecord) || pendingFile != null

    const fileTypeOptions = [...new Set([...DOCUMENT_FILE_TYPES, draft.fileType].filter(Boolean))]

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">{dealId}</p>
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
          {DOCUMENT_SLOT_META.map((slot) => {
            const record = slotDocument(related, opportunity.id, slot.id)
            return (
              <button
                key={slot.id}
                type="button"
                title={slot.label}
                onClick={() => requestLeave(() => loadSlot(slot.id))}
                className={`inline-flex items-center gap-1 rounded-t-lg px-2.5 py-2 text-xs font-semibold ${
                  tab === slot.id && mode === 'slot'
                    ? 'bg-accent-soft text-navy-900'
                    : 'text-ink-muted hover:bg-canvas'
                }`}
              >
                {slot.abbr}
                <SlotPresenceIcon available={hasAttachedFile(record)} size="sm" />
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
                  setPendingFile(null)
                })
              }
              className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
                editingId === doc.id && mode === 'custom'
                  ? 'bg-accent-soft text-navy-900'
                  : 'text-ink-muted hover:bg-canvas'
              }`}
            >
              {slotAbbreviation(doc.docType)}
            </button>
          ))}
          <button
            type="button"
            onClick={startNew}
            className={`ml-auto mb-1 mr-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              mode === 'new' ? 'bg-accent-soft text-navy-900' : 'bg-navy-900 text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add New Document
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
          <FileAttachmentField
            fileName={draft.fileName}
            fileSize={draft.fileSize}
            available={available}
            pendingFile={pendingFile}
            disabled={saving || deleting}
            onPick={(file) => {
              setPendingFile(file)
              setDraft((p) => ({
                ...p,
                fileName: file.name,
                fileSize: file.size,
                fileType: fileTypeFromFileName(file.name),
                storage: 'local',
                name: p.name || file.name.replace(/\.[^.]+$/, ''),
              }))
            }}
            onClear={() => {
              setPendingFile(null)
              setDraft((p) => ({
                ...p,
                fileName: '',
                fileSize: 0,
                storage: isOpenableDocumentUrl(p.link) ? 'url' : 'none',
                webUrl: '',
                driveItemId: '',
              }))
            }}
            onOpen={() => void openAttached()}
          />
          {mode === 'slot' ? (
            <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
              Type
              <input
                className="mt-1 h-10 w-full rounded-lg border border-border bg-canvas px-3 text-sm font-normal text-ink-muted"
                value={draft.docType}
                readOnly
                aria-readonly="true"
                title="Standard slots keep their type"
              />
            </label>
          ) : (
            <div>
              <span className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Type</span>
              <CreatableSelect
                testId="document-type"
                value={draft.docType}
                options={knownCustomTypes}
                onChange={(value) => setDraft((p) => ({ ...p, docType: value }))}
                placeholder="e.g. Quality of Earnings Report"
                createLabel={(value) => `Use “${value}” as a new type`}
              />
              {typeProblem && draft.docType.trim() && <p className="mt-1 text-[11px] text-attention normal-case">{typeProblem}</p>}
            </div>
          )}
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
              value={`${opportunity.projectName} (${dealId})`}
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
              {fileTypeOptions.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Optional SharePoint URL
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm font-normal text-ink"
              value={draft.link}
              placeholder="https://…"
              onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))}
            />
          </label>
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
          {mode === 'new' && <p className="mb-2 text-xs text-ink-muted">New document for {opportunity.projectName}. Nothing is created until you save.</p>}
          <button
            type="button"
            data-testid="document-save"
            disabled={!canSave}
            onClick={() => void persist()}
            className={`h-10 w-full rounded-lg text-sm font-semibold disabled:cursor-not-allowed ${
              canSave ? 'bg-navy-900 text-white hover:bg-navy-800' : 'border border-border bg-white text-ink-muted'
            }`}
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
          {footerExtra && mode !== 'new' && <div className="mt-2">{footerExtra}</div>}
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
          message="Remove this document from the CRM? The uploaded file is deleted here. A copy in OneDrive is not deleted."
          confirmLabel="Delete Document"
          confirming={deleting}
          onCancel={() => {
            if (!deleting) setConfirmDelete(false)
          }}
          onConfirm={() => {
            if (!editingId || deletingRef.current) return
            deletingRef.current = true
            setDeleting(true)
            const id = editingId
            void deleteDocumentBlob(owner, id)
              .catch(() => undefined)
              .then(() => (isWorkspaceShared() ? deleteWorkspaceFile(id) : undefined))
              .then(() => deleteDocument(id))
              .then(() => {
                setConfirmDelete(false)
                setDeleting(false)
                deletingRef.current = false
                setPendingFile(null)
                if (isDefaultDocumentSlot(draft.docType)) {
                  const empty = emptyDraft(normalizeDocSlot(draft.docType))
                  setEditingId(null)
                  setMode('slot')
                  setTab(normalizeDocSlot(draft.docType))
                  setDraft(empty)
                  setSaved(empty)
                } else {
                  const empty = emptyDraft('NDA')
                  setEditingId(null)
                  setMode('slot')
                  setTab('NDA')
                  setDraft(empty)
                  setSaved(empty)
                }
                setMessage('Document removed')
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

function normalizeOrId(doc: DocumentRecord): string {
  if (!isDefaultDocumentSlot(doc.docType)) return doc.id
  return normalizeDocSlot(doc.docType)
}
