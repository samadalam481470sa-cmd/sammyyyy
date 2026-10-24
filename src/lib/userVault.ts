/** Flush in-memory CRM collections into the signed-in email vault before logout. */

type FlushFn = () => void

const flushers = new Set<FlushFn>()

export function registerVaultFlush(fn: FlushFn): () => void {
  flushers.add(fn)
  return () => {
    flushers.delete(fn)
  }
}

export function flushAllUserVaults(): void {
  for (const fn of [...flushers]) {
    try {
      fn()
    } catch {
      // keep signing out even if one collection fails to write
    }
  }
}
