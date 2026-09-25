/** Formats whole-dollar amounts compactly for executive display, e.g. $184M, $26.4M. */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `$${trimZero(amount / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `$${trimZero(amount / 1_000_000)}M`
  if (abs >= 1_000) return `$${trimZero(amount / 1_000)}K`
  return `$${amount.toLocaleString('en-US')}`
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)
}

/** "Sep 29" or "Sep 29, 2027" when outside the current year. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Relative timestamp for activity feeds: "2 hours ago", "Yesterday", "3 days ago". */
export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 1) return 'Just now'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

/** Days from today to the given ISO date; negative = in the past. */
export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/** Time-of-day greeting for the header. */
export function greetingForNow(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
