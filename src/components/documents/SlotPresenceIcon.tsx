import { Check, X } from 'lucide-react'

interface SlotPresenceIconProps {
  available: boolean
  size?: 'sm' | 'md'
}

export function SlotPresenceIcon({ available, size = 'md' }: SlotPresenceIconProps) {
  const box = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  if (available) {
    return (
      <span
        className={`inline-flex ${box} items-center justify-center rounded-full bg-emerald-50 text-emerald-700`}
        title="Available"
        aria-label="Available"
      >
        <Check className={icon} strokeWidth={2.75} />
      </span>
    )
  }
  return (
    <span
      className={`inline-flex ${box} items-center justify-center rounded-full bg-rose-50 text-rose-600`}
      title="Missing"
      aria-label="Missing"
    >
      <X className={icon} strokeWidth={2.75} />
    </span>
  )
}
