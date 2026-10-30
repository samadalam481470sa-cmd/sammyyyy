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
