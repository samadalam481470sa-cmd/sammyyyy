import { FileText } from 'lucide-react'

interface SlotPresenceIconProps {
  available: boolean
  size?: 'sm' | 'md'
}

export function SlotPresenceIcon({ available, size = 'md' }: SlotPresenceIconProps) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span
      className={`inline-flex ${box} items-center justify-center rounded-lg ${
        available ? 'bg-navy-900 text-white' : 'bg-canvas text-ink-muted'
      }`}
      title={available ? 'Document on file' : 'No document attached'}
      aria-label={available ? 'Document on file' : 'No document attached'}
    >
      <FileText className={icon} strokeWidth={1.75} />
    </span>
  )
}
