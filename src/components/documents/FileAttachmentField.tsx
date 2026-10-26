import { useRef, useState, type DragEvent } from 'react'
import { FileUp, Paperclip } from 'lucide-react'

interface FileAttachmentFieldProps {
  fileName?: string
  fileSize?: number
  available: boolean
  pendingFile: File | null
  onPick: (file: File) => void
  onClear: () => void
  onOpen: () => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`
}

export function FileAttachmentField({
  fileName,
  fileSize,
  available,
  pendingFile,
  onPick,
  onClear,
  onOpen,
  disabled,
}: FileAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropOver, setDropOver] = useState(false)
  const displayName = pendingFile?.name || fileName || ''
  const displaySize = pendingFile?.size ?? fileSize ?? 0
  const hasFile = Boolean(pendingFile || available)

  const take = (file: File | undefined) => {
    if (!file || disabled) return
    onPick(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDropOver(false)
    take(event.dataTransfer.files[0])
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf"
        onChange={(e) => {
          take(e.target.files?.[0])
          e.currentTarget.value = ''
        }}
      />
      {hasFile ? (
        <div className="rounded-lg border border-border bg-canvas px-3 py-3">
          <div className="flex items-start gap-2">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{displayName || 'Attached file'}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {displaySize ? formatSize(displaySize) : 'Ready'}
                {pendingFile ? ' · not saved yet' : ''}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex h-9 items-center rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white hover:bg-navy-800"
            >
              Open document
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-ink-muted"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDropOver(true)
          }}
          onDragLeave={() => setDropOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border border-dashed px-3 py-4 text-center ${
            dropOver ? 'border-accent bg-accent-soft/40' : 'border-border bg-canvas'
          }`}
        >
          <FileUp className="mx-auto h-5 w-5 text-ink-subtle" />
          <p className="mt-2 text-sm font-medium text-ink">Upload a file into the CRM</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Drag and drop, or choose a PDF / Office file. Missing slots stay marked with an X until
            a file is saved.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white hover:bg-navy-800"
          >
            Choose file
          </button>
        </div>
      )}
    </div>
  )
}
