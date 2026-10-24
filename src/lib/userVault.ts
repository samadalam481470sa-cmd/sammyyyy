/** Flush in-memory CRM collections into the signed-in email vault before logout. */

type FlushFn = () => void
type CommitFn = () => void | Promise<void>

const flushers = new Set<FlushFn>()
const commits = new Set<CommitFn>()

export function registerVaultFlush(fn: FlushFn): () => void {
  flushers.add(fn)
  return () => {
    flushers.delete(fn)
  }
}

export function registerPendingCommit(fn: CommitFn): () => void {
  commits.add(fn)
  return () => {
    commits.delete(fn)
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

/** Persist open editors (opportunities, tasks, documents) for this login. */
export async function commitAllPendingEdits(): Promise<void> {
  await Promise.all(
    [...commits].map((fn) =>
      Promise.resolve()
        .then(fn)
        .catch(() => undefined),
    ),
  )
}

export function attachVaultUnloadFlush(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onLeave = () => {
    void commitAllPendingEdits()
    flushAllUserVaults()
  }
  window.addEventListener('pagehide', onLeave)
  window.addEventListener('beforeunload', onLeave)
  return () => {
    window.removeEventListener('pagehide', onLeave)
    window.removeEventListener('beforeunload', onLeave)
  }
}
