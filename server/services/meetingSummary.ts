/**
 * Meeting summaries from an uploaded transcript.
 *
 * Off unless an administrator sets MEETING_SUMMARY_ENABLED=1 (explicit approval
 * to send transcripts to the AI provider) AND one provider key:
 *   GEMINI_API_KEY=...   Google Gemini (used first when set; optional GEMINI_MODEL)
 *   OPENAI_API_KEY=...   OpenAI (optional OPENAI_MODEL, default gpt-4o-mini)
 * Keys are server-side secrets and are never sent to browsers.
 *
 * The model receives only the transcript text, with instructions to use nothing else.
 * Output is validated; anything malformed is rejected rather than shown.
 */
import { httpsFetch } from './httpsFetch.ts'
import { z } from 'zod'
import { geminiConfigured, geminiGenerate, geminiModel } from './gemini.ts'

export const SUMMARY_MAX_CHARS = 120_000

export function meetingSummaryProvider(): string | null {
  if (process.env.MEETING_SUMMARY_ENABLED !== '1') return null
  if (geminiConfigured()) return `Google Gemini ${geminiModel()} (admin-configured)`
  if (!process.env.OPENAI_API_KEY) return null
  return `OpenAI ${process.env.OPENAI_MODEL || 'gpt-4o-mini'} (admin-configured)`
}

const listOf = z.array(z.string().trim().min(1).max(600)).max(25)
export const summarySchema = z.object({
  discussion: listOf,
  decisions: listOf,
  openQuestions: listOf,
  nextSteps: listOf,
  proposedActions: z
    .array(z.object({ action: z.string().trim().min(3).max(300), owner: z.string().trim().max(120).optional().nullable() }))
    .max(15),
})

export type ParsedSummary = z.infer<typeof summarySchema>

const SYSTEM = [
  'You summarize a business meeting transcript for an acquisitions CRM.',
  'Use ONLY the transcript text you are given. Do not use the meeting title, calendar data, outside knowledge or assumptions.',
  'Never invent names, numbers, dates, decisions or dialogue. If something is not in the transcript, leave it out.',
  'Return JSON with keys: discussion (key points discussed), decisions (decisions actually stated),',
  'openQuestions (questions left unresolved), nextSteps (next steps stated), proposedActions (array of {action, owner})',
  'where each action is a concrete follow-up stated or clearly agreed in the transcript and owner is the person named for it, or null.',
  'Each list may be empty. Keep every item short and factual.',
].join(' ')

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class SummaryUnavailable extends Error {}

export async function summarizeTranscript(transcript: string, fetchImpl: FetchLike = httpsFetch): Promise<{ summary: ParsedSummary; provider: string; truncated: boolean }> {
  const provider = meetingSummaryProvider()
  if (!provider) throw new SummaryUnavailable('No AI summary service is configured for this CRM.')
  const text = transcript.trim()
  if (!text) throw new Error('The transcript is empty.')
  const truncated = text.length > SUMMARY_MAX_CHARS
  const userText = `TRANSCRIPT:\n${text.slice(0, SUMMARY_MAX_CHARS)}`
  let content: string
  if (geminiConfigured()) {
    content = await geminiGenerate({ system: SYSTEM, user: userText, json: true }, fetchImpl)
  } else {
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userText },
        ],
      }),
    })
    if (!res.ok) throw new Error(`The AI service returned ${res.status}.`)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    content = data.choices?.[0]?.message?.content ?? ''
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('The AI service returned an unreadable summary.')
  }
  const checked = summarySchema.safeParse(parsed)
  if (!checked.success) throw new Error('The AI service returned a summary in the wrong shape.')
  return { summary: checked.data, provider, truncated }
}
