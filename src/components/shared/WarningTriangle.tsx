import { AlertTriangle } from 'lucide-react'
import type { DealWarning } from '@/lib/attention'

interface WarningTriangleProps {
  warning: DealWarning | null
  className?: string
}

export function WarningTriangle({ warning, className = '' }: WarningTriangleProps) {
  if (!warning) return null
  const color = warning.level === 'red' ? 'text-[var(--color-danger)]' : 'text-warning'
  return (
    <span
      className={`inline-flex shrink-0 ${color} ${className}`}
      title={warning.detail}
      aria-label={warning.detail}
    >
      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  )
}
