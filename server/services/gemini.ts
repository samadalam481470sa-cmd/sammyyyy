/**
 * Google Gemini client (server only).
 *
 * Settings in the server environment:
 *   GEMINI_API_KEY   secret from Google AI Studio; never sent to browsers
 *   GEMINI_MODEL     optional, default gemini-flash-latest
 *
 * If GEMINI_API_KEY is not set but OPENAI_API_KEY holds a Google key
 * (starts with "AIza" or "AQ."), that key is used for Gemini instead,
 * because a Google key can never work against OpenAI.
 *
 * The key goes in the x-goog-api-key header, never in the URL, so it cannot
 * appear in request logs.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

export function isGoogleKey(key: string | undefined): boolean {
  const k = key?.trim() ?? ''
  return k.startsWith('AIza') || k.startsWith('AQ.')
}

export function geminiKey(): string | null {
  const direct = process.env.GEMINI_API_KEY?.trim()
  if (direct) return direct
  const fallback = process.env.OPENAI_API_KEY?.trim()
  return isGoogleKey(fallback) ? fallback! : null
}

export function geminiConfigured(): boolean {
  return geminiKey() !== null
}

export function geminiModel(): string {
  const m = process.env.GEMINI_MODEL?.trim()
  // Model ids are short tokens; reject anything that could change the URL path.
  return m && /^[a-z0-9.\-]+$/i.test(m) ? m : DEFAULT_GEMINI_MODEL
}

export async function geminiGenerate(
  opts: { system: string; user: string; json?: boolean; temperature?: number },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const key = geminiKey()
  if (!key) throw new Error('No Gemini API key is set.')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    // A stuck request should fail with a clear message instead of hanging the page.
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      if (body.error?.message) detail = ` ${body.error.message.slice(0, 200)}`
    } catch {
      // no JSON body
    }
    throw new Error(`The AI service returned ${res.status}.${detail}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
}

/**
 * Reachability check for administrators. Sends no key and no CRM data:
 * a plain GET to Google's API host, timed, so a network stall can be told
 * apart from a key or model problem.
 */
export async function geminiReachability(fetchImpl: FetchLike = fetch): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models', { signal: AbortSignal.timeout(15_000) })
    return { ok: true, status: res.status, ms: Date.now() - t0 }
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
  }
}
