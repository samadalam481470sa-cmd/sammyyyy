/**
 * A small fetch-like function built on node:https, forced to IPv4.
 *
 * On Azure App Service (Linux) the global fetch stalled on calls to Google while
 * node:https calls (Microsoft sign-in key lookups) worked, so outbound AI calls use this.
 * Supports what the AI clients need: method, headers, a string body, and an AbortSignal.
 */
import https from 'node:https'

export async function httpsFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input)
  const headers: Record<string, string> = {}
  new Headers(init.headers).forEach((value, key) => {
    headers[key] = value
  })
  const body = typeof init.body === 'string' ? init.body : init.body == null ? undefined : String(init.body)
  if (body !== undefined) headers['content-length'] = String(Buffer.byteLength(body))

  return new Promise<Response>((resolve, reject) => {
    const signal = init.signal ?? undefined
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
      return
    }
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? 'GET',
        headers,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const out = new Headers()
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') out.set(k, v)
            else if (Array.isArray(v)) out.set(k, v.join(', '))
          }
          const status = res.statusCode ?? 0
          const noBody = status === 204 || status === 304
          resolve(new Response(noBody ? null : Buffer.concat(chunks), { status, headers: out }))
        })
        res.on('error', reject)
      },
    )
    const onAbort = () => {
      req.destroy()
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    req.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    })
    req.on('close', () => signal?.removeEventListener('abort', onAbort))
    if (body !== undefined) req.write(body)
    req.end()
  })
}
