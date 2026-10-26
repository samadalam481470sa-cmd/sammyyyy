/** Split a To/Cc/Bcc field into bare email addresses. Names in angle brackets are unwrapped. */
export function parseAddresses(raw: string | undefined | null): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(/[;,]/)) {
    const angled = part.match(/<([^<>]+)>/)
    const address = (angled?.[1] ?? part).trim()
    if (!address.includes('@') || /\s/.test(address)) continue
    out.push(address)
  }
  return out
}

export function recipientKey(raw: string | undefined | null): string {
  return parseAddresses(raw)
    .map((address) => address.toLowerCase())
    .sort()
    .join(',')
}

export function uniqueAddresses(addresses: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const address of addresses) {
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(address)
  }
  return out
}
