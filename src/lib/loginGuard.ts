/**
 * Login-page deterrents against casual inspect / view-source.
 * This cannot stop a determined attacker from reading a public JS bundle —
 * real protection is signed sessions, hashed keys, and CSP.
 */
const BLOCKED = new Set(['F12'])

function isInspectChord(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase()
  const ctrl = e.ctrlKey || e.metaKey
  if (BLOCKED.has(e.key)) return true
  if (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) return true
  if (ctrl && ['u', 's'].includes(key)) return true
  return false
}

export function attachLoginShield(root: HTMLElement): () => void {
  const onContext = (e: Event) => {
    const target = e.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    e.preventDefault()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!isInspectChord(e)) return
    e.preventDefault()
    e.stopPropagation()
  }
  const onDrag = (e: DragEvent) => {
    e.preventDefault()
  }

  window.addEventListener('contextmenu', onContext, true)
  window.addEventListener('keydown', onKey, true)
  root.addEventListener('dragstart', onDrag)

  return () => {
    window.removeEventListener('contextmenu', onContext, true)
    window.removeEventListener('keydown', onKey, true)
    root.removeEventListener('dragstart', onDrag)
  }
}
