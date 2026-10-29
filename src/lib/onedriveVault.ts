import { getGraphAccessToken } from '@/auth/msal'

const PATH = 'Newport%20CRM/vault.json'

export interface CrmVaultFile {
  updatedAt: string
  opportunities: unknown[]
  tasks: unknown[]
  documents: unknown[]
  contacts: unknown[]
  activity: unknown[]
}

/**
 * Read the vault from OneDrive.
 *
 * `/content` answers with a redirect to a separate download host. A browser that follows
 * that redirect with an Authorization header fails the CORS check ("Failed to fetch"),
 * so the vault was saved but never read back. Ask Graph for the file's short-lived
 * download URL instead, then fetch that URL with no Authorization header.
 */
export async function pullCrmVault(): Promise<CrmVaultFile | null> {
  try {
    const token = await getGraphAccessToken(['User.Read', 'Files.ReadWrite'])
    if (!token) return null
    const meta = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${PATH}?$select=id,@microsoft.graph.downloadUrl`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!meta.ok) return null
    const url = ((await meta.json()) as Record<string, unknown>)['@microsoft.graph.downloadUrl']
    if (typeof url !== 'string' || !url) return null
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as CrmVaultFile
    if (!json || !Array.isArray(json.opportunities) || typeof json.updatedAt !== 'string') return null
    return json
  } catch {
    // offline or blocked: keep working from this browser's copy
    return null
  }
}

export async function pushCrmVault(vault: CrmVaultFile): Promise<boolean> {
  const token = await getGraphAccessToken(['User.Read', 'Files.ReadWrite'])
  if (!token) return false
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${PATH}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vault),
  })
  return res.ok
}
