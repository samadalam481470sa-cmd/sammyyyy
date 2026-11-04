/** Soft priority chips used everywhere tasks appear: A muted red, B amber, C blue. */
export const PRIORITY_CHIP: Record<string, string> = {
  A: 'border border-[#f3c4bf] bg-[#fdecea] text-[#a8321f]',
  B: 'border border-[#f0d9a8] bg-[#fff5e1] text-[#8a5a00]',
  C: 'border border-accent-muted bg-accent-soft text-[#245f93]',
}

export function priorityChipClass(priority: string | null | undefined): string {
  return `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${PRIORITY_CHIP[priority ?? ''] ?? PRIORITY_CHIP.C}`
}

export const PRIORITY_LEGEND = 'A = must move this week · B = important but can wait · C = monitor only'
