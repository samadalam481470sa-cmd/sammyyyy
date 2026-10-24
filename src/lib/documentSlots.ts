import type { DocumentRecord } from '@/data/mockModules'

export const DOCUMENT_SLOT_META = [
  { id: 'NDA', abbr: 'NDA', label: 'NDA' },
  { id: 'CIM', abbr: 'CIM', label: 'CIM' },
  { id: 'LOI', abbr: 'LOI', label: 'LOI' },
  { id: 'IOI', abbr: 'IOI', label: 'IOI' },
  { id: 'Draft Agreement', abbr: 'Draft', label: 'Draft Agreement' },
  { id: 'Finalized Agreement', abbr: 'Final', label: 'Finalized Agreement' },
] as const

export type DefaultDocumentSlot = (typeof DOCUMENT_SLOT_META)[number]['id']

export const DEFAULT_DOCUMENT_SLOTS: readonly DefaultDocumentSlot[] = DOCUMENT_SLOT_META.map(
  (slot) => slot.id,
)

const SLOT_ALIASES: Record<string, DefaultDocumentSlot> = {
  nda: 'NDA',
  cim: 'CIM',
  teaser: 'CIM',
  'teaser / cim': 'CIM',
  'teaser/cim': 'CIM',
  loi: 'LOI',
  ioi: 'IOI',
  draft: 'Draft Agreement',
  'draft agreement': 'Draft Agreement',
  final: 'Finalized Agreement',
  finalized: 'Finalized Agreement',
  'finalized agreement': 'Finalized Agreement',
}

export function normalizeDocSlot(docType: string): string {
  const value = docType.trim()
  if (!value) return value
  return SLOT_ALIASES[value.toLowerCase()] ?? value
}

export function isDefaultDocumentSlot(docType: string): boolean {
  const normalized = normalizeDocSlot(docType)
  return DOCUMENT_SLOT_META.some((slot) => slot.id === normalized)
}

export function slotAbbreviation(slot: string): string {
  const normalized = normalizeDocSlot(slot)
  return DOCUMENT_SLOT_META.find((entry) => entry.id === normalized)?.abbr ?? slot
}

export function documentsForOpportunity(
  documents: DocumentRecord[],
  opportunityId: string,
): DocumentRecord[] {
  return documents.filter((doc) => doc.opportunityId === opportunityId)
}

export function slotDocument(
  documents: DocumentRecord[],
  opportunityId: string,
  slot: string,
): DocumentRecord | null {
  const wanted = normalizeDocSlot(slot)
  return (
    documentsForOpportunity(documents, opportunityId).find(
      (doc) => normalizeDocSlot(doc.docType) === wanted,
    ) ?? null
  )
}

export function customDocumentsForOpportunity(
  documents: DocumentRecord[],
  opportunityId: string,
): DocumentRecord[] {
  return documentsForOpportunity(documents, opportunityId).filter(
    (doc) => !isDefaultDocumentSlot(doc.docType),
  )
}

export function inferFileType(
  doc: Pick<DocumentRecord, 'fileType' | 'link' | 'name'> & {
    fileName?: string
    webUrl?: string
  },
): string {
  if (doc.fileType?.trim()) return doc.fileType.trim().toLowerCase()
  const haystack = `${doc.link ?? ''} ${doc.webUrl ?? ''} ${doc.fileName ?? ''} ${doc.name ?? ''}`.toLowerCase()
  if (haystack.includes('.docx') || haystack.includes('word')) return 'docx'
  if (haystack.includes('.xlsx') || haystack.includes('excel') || haystack.includes('.xls')) {
    return 'xlsx'
  }
  if (haystack.includes('.pptx') || haystack.includes('powerpoint')) return 'pptx'
  if (haystack.includes('.pdf')) return 'pdf'
  if ((doc.link ?? '').trim() || (doc.webUrl ?? '').trim()) return 'url'
  return ''
}

export function isOpenableDocumentUrl(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** True only when a real file or openable URL exists — metadata-only rows count as missing. */
export function hasAttachedFile(doc: DocumentRecord | null | undefined): boolean {
  if (!doc) return false
  if (doc.storage === 'local' || doc.storage === 'onedrive') return true
  if ((doc.fileSize ?? 0) > 0 && Boolean(doc.fileName?.trim())) return true
  return isOpenableDocumentUrl(doc.webUrl) || isOpenableDocumentUrl(doc.link)
}

export function fileTypeFromFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'doc') return 'docx'
  if (ext === 'xls') return 'xlsx'
  if (ext === 'ppt') return 'pptx'
  if (ext === 'pdf' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return ext
  return ext || ''
}
