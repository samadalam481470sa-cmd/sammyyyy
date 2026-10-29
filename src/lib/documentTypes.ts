/** Custom document types, shared through the workspace when a server is configured. */
const KEY = 'newport_crm_custom_document_types'
export const DOCUMENT_TYPES_CHANGED = 'newport-document-types-changed'

export function storedCustomTypes(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((row): row is string => typeof row === 'string') : []
  } catch {
    return []
  }
}

export function saveCustomTypes(types: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(types)].slice(-500)))
  } catch {
    // storage blocked
  }
}

export function rememberCustomType(type: string): void {
  const list = storedCustomTypes()
  if (list.some((row) => row.toLowerCase() === type.toLowerCase())) return
  saveCustomTypes([...list, type])
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DOCUMENT_TYPES_CHANGED))
}
