import { parseIsoDate } from "./dates.ts"

function formatScaled(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 1 })
}

export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? "-" : ""
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `${sign}$${formatScaled(absolute / 1_000_000_000)}B`
  if (absolute >= 1_000_000) return `${sign}$${formatScaled(absolute / 1_000_000)}M`
  if (absolute >= 1_000) return `${sign}$${formatScaled(absolute / 1_000)}K`
  return `${sign}$${Math.round(absolute).toLocaleString("en-US")}`
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(iso: string | null, withYear = false): string {
  if (!iso) return "—"
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  })
}

export function formatRelativeTime(iso: string, nowIso: string): string {
  const delta = new Date(nowIso).getTime() - new Date(iso).getTime()
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(delta / 3_600_000)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  if (hours < 48) return "Yesterday"
  const days = Math.round(delta / 86_400_000)
  return `${days} day${days === 1 ? "" : "s"} ago`
}
