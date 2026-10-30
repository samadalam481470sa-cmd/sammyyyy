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

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high'

async function readGoogleError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } }
    const msg = body.error?.message ?? body.error?.status ?? ''
    return msg ? ` ${msg.slice(0, 240)}` : ''
  } catch {
    return ''
  }
}

/**
 * One generateContent call. Newer Flash models "think" at medium or high effort by default,
 * which can take minutes on a long transcript, so this asks for low effort. If a model does
 * not accept that setting, the call is repeated once without it.
 */
export async function geminiGenerate(
  opts: { system: string; user: string; json?: boolean; temperature?: number; thinking?: ThinkingLevel | null; timeoutMs?: number },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const key = geminiKey()
  if (!key) throw new Error('No Gemini API key is set.')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`
  const thinking = opts.thinking === undefined ? 'low' : opts.thinking
  // Azure closes requests after about 230 seconds; stop well before that with a clear message.
  const timeoutMs = opts.timeoutMs ?? 150_000

  const call = (withThinking: boolean) =>
    fetchImpl(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: 'user', parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          ...(withThinking && thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
        },
      }),
    })

  let res: Response
  try {
    res = await call(true)
    if (res.status === 400 && thinking) {
      const detail = await readGoogleError(res.clone())
      if (/thinking/i.test(detail)) res = await call(false)
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`Google Gemini did not answer within ${Math.round(timeoutMs / 1000)} seconds. Try again in a minute.`)
    }
    throw new Error(`Google Gemini could not be reached: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) {
    const detail = await readGoogleError(res)
    const hint =
      res.status === 401 || res.status === 403
        ? ' Check that the key was created in Google AI Studio (aistudio.google.com/apikey) and is saved as GEMINI_API_KEY.'
        : res.status === 429
          ? ' The free tier limit was reached; wait a minute and try again.'
          : ''
    throw new Error(`The AI service returned ${res.status}.${detail}${hint}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  }
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
}

export interface AiSelfTest {
  ok: boolean
  provider: string | null
  model: string | null
  ms: number
  message: string
}

/** A tiny request that shows whether the configured key and model answer. Never returns the key. */
export async function geminiSelfTest(fetchImpl: FetchLike = fetch): Promise<AiSelfTest> {
  const started = Date.now()
  if (!geminiConfigured()) {
    return { ok: false, provider: null, model: null, ms: 0, message: 'No Google Gemini key is saved on the server.' }
  }
  try {
    const text = await geminiGenerate(
      { system: 'You are a connection test.', user: 'Reply with the single word OK.', thinking: 'minimal', timeoutMs: 45_000 },
      fetchImpl,
    )
    return { ok: Boolean(text), provider: 'Google Gemini', model: geminiModel(), ms: Date.now() - started, message: text ? `Gemini answered: ${text.slice(0, 40)}` : 'Gemini answered with no text.' }
  } catch (err) {
    return { ok: false, provider: 'Google Gemini', model: geminiModel(), ms: Date.now() - started, message: err instanceof Error ? err.message : String(err) }
  }
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
