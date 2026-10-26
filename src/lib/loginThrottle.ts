const THROTTLE_KEY = 'newport_crm_login_throttle_v1'
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8

interface ThrottleState {
  failures: number[]
}

function load(): ThrottleState {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY)
    if (!raw) return { failures: [] }
    const parsed = JSON.parse(raw) as ThrottleState
    const cutoff = Date.now() - WINDOW_MS
    const failures = Array.isArray(parsed.failures)
      ? parsed.failures.filter((t) => typeof t === 'number' && t > cutoff)
      : []
    return { failures }
  } catch {
    return { failures: [] }
  }
}

function save(state: ThrottleState): void {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function assertLoginAllowed(): { ok: true } | { ok: false; error: string } {
  const { failures } = load()
  if (failures.length < MAX_FAILURES) return { ok: true }
  const oldest = Math.min(...failures)
  const waitMin = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60000))
  return {
    ok: false,
    error: `Too many failed sign-in attempts. Try again in ${waitMin} min.`,
  }
}

export function recordLoginFailure(): void {
  const state = load()
  state.failures.push(Date.now())
  save(state)
}

export function recordLoginSuccess(): void {
  save({ failures: [] })
}
