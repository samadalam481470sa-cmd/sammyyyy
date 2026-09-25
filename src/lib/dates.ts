const DAY_MS = 86_400_000

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isoDate(today: Date, offsetDays: number): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function daysFromToday(iso: string, today: Date): number {
  const diff = parseIsoDate(iso).getTime() - startOfDay(today).getTime()
  return Math.round(diff / DAY_MS)
}

export function isOverdue(iso: string | null, asOfIso: string): boolean {
  if (!iso) return false
  return daysFromToday(iso, new Date(asOfIso)) < 0
}
