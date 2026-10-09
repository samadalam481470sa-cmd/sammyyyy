/**
 * Stable anonymous labels for the public demo.
 * Codes are derived from record IDs, never from the current sort/filter order.
 * Sample names and figures are illustrative only — not live Newport metrics.
 */

/** Seed opportunity IDs (A–P). Order is fixed and ID-keyed, not UI position. */
export const DEMO_SEED_OPPORTUNITY_IDS = [
  'opp-a',
  'opp-b',
  'opp-c',
  'opp-d',
  'opp-e',
  'opp-f',
  'opp-g',
  'opp-h',
  'opp-i',
  'opp-j',
  'opp-k',
  'opp-l',
  'opp-m',
  'opp-n',
  'opp-o',
  'opp-p',
] as const

export type DemoSeedOpportunityId = (typeof DEMO_SEED_OPPORTUNITY_IDS)[number]

/** Excel-style column codes: 0 → A, 25 → Z, 26 → AA. */
export function indexToLetterCode(index: number): string {
  if (!Number.isFinite(index) || index < 0) return 'A'
  let n = Math.floor(index)
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export function letterCodeToIndex(code: string): number {
  const letters = code.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(letters)) return 0
  let n = 0
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

function fnv1a(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Map any opportunity id to a stable letter code.
 * Seed rows `opp-a`…`opp-p` keep A–P. Other ids hash to Q+ so they never
 * steal a seed letter when the table is filtered or reordered.
 */
export function letterCodeForOpportunityId(id: string): string {
  const seeded = /^opp-([a-z]{1,2})$/i.exec(id.trim())
  if (seeded) {
    const code = seeded[1].toUpperCase()
    const idx = letterCodeToIndex(code)
    if (idx >= 0 && idx < DEMO_SEED_OPPORTUNITY_IDS.length) return code
  }
  const seedIdx = (DEMO_SEED_OPPORTUNITY_IDS as readonly string[]).indexOf(id)
  if (seedIdx >= 0) return indexToLetterCode(seedIdx)
  return indexToLetterCode(DEMO_SEED_OPPORTUNITY_IDS.length + (fnv1a(id) % 400))
}

export function anonymousProjectName(id: string): string {
  return `Project ${letterCodeForOpportunityId(id)}`
}

export function anonymousEntityName(id: string): string {
  return `Entity ${letterCodeForOpportunityId(id)}`
}

export function demoProjectNumber(id: string): number {
  const seedIdx = (DEMO_SEED_OPPORTUNITY_IDS as readonly string[]).indexOf(id)
  if (seedIdx >= 0) return seedIdx + 1
  return letterCodeToIndex(letterCodeForOpportunityId(id)) + 1
}

export function isDemoSeedOpportunityId(id: string): boolean {
  return (DEMO_SEED_OPPORTUNITY_IDS as readonly string[]).includes(id)
}
