import type { DocumentRecord } from '@/data/mockModules'

export const DEFAULT_DOCUMENT_SLOTS = ['NDA', 'CIM', 'LOI'] as const
export type DefaultDocumentSlot = (typeof DEFAULT_DOCUMENT_SLOTS)[number]

export function normalizeDocSlot(docType: string): string {
  const value = docType.trim()
  if (value === 'Teaser / CIM' || value.toUpperCase() === 'CIM') return 'CIM'
  return value
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
  const defaults = new Set<string>(DEFAULT_DOCUMENT_SLOTS)
  return documentsForOpportunity(documents, opportunityId).filter(
    (doc) => !defaults.has(normalizeDocSlot(doc.docType)),
  )
}

export function inferFileType(doc: Pick<DocumentRecord, 'fileType' | 'link' | 'name'>): string {
  if (doc.fileType?.trim()) return doc.fileType.trim().toLowerCase()
  const haystack = `${doc.link ?? ''} ${doc.name ?? ''}`.toLowerCase()
  if (haystack.includes('.docx') || haystack.includes('word')) return 'docx'
  if (haystack.includes('.xlsx') || haystack.includes('excel') || haystack.includes('.xls')) {
    return 'xlsx'
  }
  if (haystack.includes('.pptx') || haystack.includes('powerpoint')) return 'pptx'
  if (haystack.includes('.pdf') || haystack.includes('pdf')) return 'pdf'
  if ((doc.link ?? '').trim()) return 'url'
  return ''
}

export function hasAttachedFile(doc: DocumentRecord | null | undefined): boolean {
  return Boolean(doc && (doc.link?.trim() || inferFileType(doc)))
}
