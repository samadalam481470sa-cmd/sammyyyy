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

export async function pullCrmVault(): Promise<CrmVaultFile | null> {
  const token = await getGraphAccessToken(['User.Read', 'Files.ReadWrite'])
  if (!token) return null
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${PATH}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  const json = (await res.json()) as CrmVaultFile
  if (!json || !Array.isArray(json.opportunities) || typeof json.updatedAt !== 'string') return null
  return json
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
