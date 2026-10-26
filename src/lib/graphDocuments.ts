import { getGraphAccessToken } from '@/auth/msal'
import { slotAbbreviation } from '@/lib/documentSlots'

const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024
const CHUNK = 3276800

function graphItemPath(dealId: string, slot: string, fileName: string): string {
  const safeDeal = dealId.replace(/[\\/]/g, '-')
  const safeSlot = slotAbbreviation(slot).replace(/[\\/]/g, '-')
  const safeName = fileName.replace(/[\\/]/g, '_')
  return `Newport CRM/${safeDeal}/${safeSlot}/${safeName}`
}

function encodedRootPath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export async function uploadDealDocumentToOneDrive(input: {
  file: File
  dealId: string
  slot: string
}): Promise<{ id: string; webUrl: string; name: string } | null> {
  const token = await getGraphAccessToken()
  if (!token) return null
  const encoded = encodedRootPath(graphItemPath(input.dealId, input.slot, input.file.name))
  try {
    if (input.file.size <= SIMPLE_UPLOAD_MAX) {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encoded}:/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': input.file.type || 'application/octet-stream',
        },
        body: input.file,
      })
      if (!res.ok) return null
      const json = (await res.json()) as { id?: string; webUrl?: string; name?: string }
      if (!json.id || !json.webUrl) return null
      return { id: json.id, webUrl: json.webUrl, name: json.name || input.file.name }
    }

    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encoded}:/createUploadSession`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'replace', name: input.file.name },
        }),
      },
    )
    if (!sessionRes.ok) return null
    const session = (await sessionRes.json()) as { uploadUrl?: string }
    if (!session.uploadUrl) return null
    const buffer = await input.file.arrayBuffer()
    let offset = 0
    let last: Response | null = null
    while (offset < buffer.byteLength) {
      const end = Math.min(offset + CHUNK, buffer.byteLength)
      const chunk = buffer.slice(offset, end)
      last = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${offset}-${end - 1}/${buffer.byteLength}`,
        },
        body: chunk,
      })
      if (!last.ok && last.status !== 202) return null
      offset = end
    }
    if (!last?.ok) return null
    const json = (await last.json()) as { id?: string; webUrl?: string; name?: string }
    if (!json.id || !json.webUrl) return null
    return { id: json.id, webUrl: json.webUrl, name: json.name || input.file.name }
  } catch {
    return null
  }
}
