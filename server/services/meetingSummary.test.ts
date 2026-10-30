import { afterEach, describe, expect, it, vi } from 'vitest'
import { SummaryUnavailable, meetingSummaryProvider, summarizeTranscript } from './meetingSummary.ts'

const ok = (content: unknown) => async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))

describe('meeting summary service', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('stays off unless explicitly enabled with a key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'k')
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '')
    expect(meetingSummaryProvider()).toBeNull()
    const fetchImpl = vi.fn()
    await expect(summarizeTranscript('Mary: hi', fetchImpl)).rejects.toBeInstanceOf(SummaryUnavailable)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends only the transcript and validates the result', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'k')
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '1')
    const fetchImpl = vi.fn(ok({ discussion: ['LOI timing'], decisions: [], openQuestions: [], nextSteps: ['Send LOI'], proposedActions: [{ action: 'Send marked-up LOI', owner: 'Dennis' }] }))
    const result = await summarizeTranscript('Dennis: I will send the marked-up LOI.', fetchImpl)
    expect(result.summary.proposedActions[0].action).toBe('Send marked-up LOI')
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.messages[1].content).toBe('TRANSCRIPT:\nDennis: I will send the marked-up LOI.')
  })

  it('rejects malformed output instead of showing it', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'k')
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '1')
    await expect(summarizeTranscript('x', ok({ discussion: 'not a list' }))).rejects.toThrow(/wrong shape/)
  })
})

describe('meeting summary with Gemini', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses Gemini when GEMINI_API_KEY is set, with the key in a header only', async () => {
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '1')
    vi.stubEnv('GEMINI_API_KEY', 'gem-key')
    vi.stubEnv('OPENAI_API_KEY', '')
    expect(meetingSummaryProvider()).toMatch(/Gemini/)
    const content = { discussion: ['Deal signed'], decisions: [], openQuestions: [], nextSteps: [], proposedActions: [{ action: 'Send checklist', owner: 'Dennis' }] }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] })))
    const result = await summarizeTranscript('Dennis: I will send the checklist.', fetchImpl)
    expect(result.summary.proposedActions[0].owner).toBe('Dennis')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(url).not.toContain('gem-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('gem-key')
    const body = JSON.parse(init.body as string)
    expect(body.contents[0].parts[0].text).toBe('TRANSCRIPT:\nDennis: I will send the checklist.')
  })
})

describe('Google key saved under OPENAI_API_KEY', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('routes it to Gemini instead of OpenAI', async () => {
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '1')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'AQ.example-google-key')
    expect(meetingSummaryProvider()).toMatch(/Gemini/)
    const content = { discussion: [], decisions: [], openQuestions: [], nextSteps: [], proposedActions: [] }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] })))
    await summarizeTranscript('Mary: ok.', fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.example-google-key')
  })

  it('still uses OpenAI for a real OpenAI key', () => {
    vi.stubEnv('MEETING_SUMMARY_ENABLED', '1')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    expect(meetingSummaryProvider()).toMatch(/OpenAI/)
  })
})
