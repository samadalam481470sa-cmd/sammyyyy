import { afterEach, describe, expect, it } from 'vitest'
import { geminiGenerate, geminiSelfTest } from './gemini.ts'

const saved = { ...process.env }
afterEach(() => {
  process.env = { ...saved }
})

const answer = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))

describe('Gemini client', () => {
  it('asks for low thinking and sends the key only in the header', async () => {
    process.env.GEMINI_API_KEY = 'AQ.test'
    let url = ''
    let init: RequestInit | undefined
    const text = await geminiGenerate({ system: 's', user: 'u' }, async (u, i) => {
      url = u
      init = i
      return answer('hello')
    })
    expect(text).toBe('hello')
    expect(url).not.toContain('AQ.test')
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.test')
    expect(JSON.parse(String(init?.body)).generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' })
  })

  it('retries without thinking settings when the model rejects them', async () => {
    process.env.GEMINI_API_KEY = 'AQ.test'
    const bodies: Array<Record<string, unknown>> = []
    const text = await geminiGenerate({ system: 's', user: 'u' }, async (_u, i) => {
      bodies.push(JSON.parse(String(i?.body)))
      if (bodies.length === 1) return new Response(JSON.stringify({ error: { message: 'Thinking level is not supported for this model.' } }), { status: 400 })
      return answer('ok')
    })
    expect(text).toBe('ok')
    expect(bodies).toHaveLength(2)
    expect((bodies[1].generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined()
  })

  it('skips thought parts and explains auth failures', async () => {
    process.env.GEMINI_API_KEY = 'AQ.test'
    const text = await geminiGenerate({ system: 's', user: 'u' }, async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'final' }] } }] })),
    )
    expect(text).toBe('final')
    await expect(
      geminiGenerate({ system: 's', user: 'u' }, async () => new Response(JSON.stringify({ error: { message: 'API key not valid.' } }), { status: 401 })),
    ).rejects.toThrow(/401\. API key not valid\..*AI Studio/)
  })

  it('self-test reports the result without the key', async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    expect((await geminiSelfTest()).ok).toBe(false)
    process.env.OPENAI_API_KEY = 'AQ.secret'
    const result = await geminiSelfTest(async () => answer('OK'))
    expect(result.ok).toBe(true)
    expect(JSON.stringify(result)).not.toContain('AQ.secret')
  })
})
