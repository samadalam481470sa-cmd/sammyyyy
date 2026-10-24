import { describe, expect, it } from 'vitest'
import type { DocumentRecord } from '@/data/mockModules'
import {
  customDocumentsForOpportunity,
  DEFAULT_DOCUMENT_SLOTS,
  DOCUMENT_SLOT_META,
  fileTypeFromFileName,
  hasAttachedFile,
  isDefaultDocumentSlot,
  normalizeDocSlot,
  slotAbbreviation,
  slotDocument,
} from './documentSlots'

function doc(partial: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: 'doc-x',
    name: 'Sample',
    docType: 'NDA',
    opportunityId: 'opp-a',
    projectName: 'Project A',
    status: 'Draft',
    confidentiality: 'Confidential',
    uploadedBy: 'Mary',
    link: '',
    uploadedAt: '2026-10-23',
    notes: '',
    ...partial,
  }
}

describe('document slots', () => {
  it('lists the six required deal types with short labels', () => {
    expect([...DEFAULT_DOCUMENT_SLOTS]).toEqual([
      'NDA',
      'CIM',
      'LOI',
      'IOI',
      'Draft Agreement',
      'Finalized Agreement',
    ])
    expect(DOCUMENT_SLOT_META.map((s) => s.abbr)).toEqual([
      'NDA',
      'CIM',
      'LOI',
      'IOI',
      'Draft',
      'Final',
    ])
  })

  it('maps aliases including Teaser / CIM onto the standard slots', () => {
    expect(normalizeDocSlot('Teaser / CIM')).toBe('CIM')
    expect(normalizeDocSlot('draft')).toBe('Draft Agreement')
    expect(normalizeDocSlot('Final')).toBe('Finalized Agreement')
    expect(isDefaultDocumentSlot('Teaser / CIM')).toBe(true)
    expect(isDefaultDocumentSlot('Financials')).toBe(false)
    expect(slotAbbreviation('Draft Agreement')).toBe('Draft')
  })

  it('treats metadata-only rows as missing even when the name looks like a file', () => {
    expect(hasAttachedFile(doc({ name: 'Project A NDA.pdf', link: '' }))).toBe(false)
    expect(hasAttachedFile(null)).toBe(false)
  })

  it('marks a document available for a URL, local file, or OneDrive copy', () => {
    expect(hasAttachedFile(doc({ link: 'https://sharepoint.example/nda' }))).toBe(true)
    expect(hasAttachedFile(doc({ storage: 'local', fileName: 'nda.pdf', fileSize: 1200 }))).toBe(
      true,
    )
    expect(hasAttachedFile(doc({ storage: 'onedrive', webUrl: 'https://onedrive.live.com/nda' }))).toBe(
      true,
    )
  })

  it('finds slot rows and leaves extra types as custom documents', () => {
    const rows = [
      doc({ id: '1', docType: 'Teaser / CIM' }),
      doc({ id: '2', docType: 'Financials' }),
      doc({ id: '3', docType: 'Legal', opportunityId: 'opp-b' }),
    ]
    expect(slotDocument(rows, 'opp-a', 'CIM')?.id).toBe('1')
    expect(customDocumentsForOpportunity(rows, 'opp-a').map((row) => row.id)).toEqual(['2'])
  })

  it('maps uploaded extensions onto file types', () => {
    expect(fileTypeFromFileName('letter.docx')).toBe('docx')
    expect(fileTypeFromFileName('pack.PDF')).toBe('pdf')
  })
})
