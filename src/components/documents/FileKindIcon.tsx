import { FileSpreadsheet, FileText, FileType, FileX } from 'lucide-react'
import type { DocumentRecord } from '@/data/mockModules'
import { inferFileType } from '@/lib/documentSlots'

interface FileKindIconProps {
  kind?: string
  missing?: boolean
}

export function FileKindIcon({ kind, missing }: FileKindIconProps) {
  if (missing) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-subtle">
        <FileX className="h-4 w-4" strokeWidth={1.75} />
      </span>
    )
  }
  if (kind === 'xlsx' || kind === 'xls') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <FileSpreadsheet className="h-4 w-4" />
      </span>
    )
  }
  if (kind === 'docx' || kind === 'doc') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-800">
        <FileType className="h-4 w-4" />
      </span>
    )
  }
  if (kind === 'pptx' || kind === 'ppt') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-800">
        <FileText className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-800">
      <FileText className="h-4 w-4" />
    </span>
  )
}

export function iconKindForDocument(doc: DocumentRecord | null): { missing: boolean; kind: string } {
  if (!doc) return { missing: true, kind: '' }
  const kind = inferFileType(doc) || 'pdf'
  return { missing: false, kind }
}
