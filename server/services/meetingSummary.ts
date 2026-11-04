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
  overview: z.string().trim().max(2400).optional().default(''),
  discussion: listOf,
  decisions: listOf,
  openQuestions: listOf,
  nextSteps: listOf,
  proposedActions: z
    .array(
      z.object({
        action: z.string().trim().min(3).max(300),
        owner: z.string().trim().max(120).optional().nullable(),
        due: z.string().trim().max(120).optional().nullable(),
      }),
    )
    .max(15),
})

export type ParsedSummary = z.infer<typeof summarySchema>

const SYSTEM = [
  'You summarize a business meeting transcript for an acquisitions CRM used by an insurance M&A team.',
  'Use ONLY the transcript text you are given. Do not use the meeting title, calendar data, outside knowledge or assumptions.',
  'Never invent names, participants, numbers, dates, owners, decisions or dialogue. If something is not in the transcript, leave it out.',
  'Return JSON with keys:',
  'overview (a concise prose overview of the meeting; scale it to the transcript: about 100-200 words for a typical meeting, shorter for a short transcript; keep important financial figures, deal terms and context exactly as stated),',
  'discussion (distinct key points discussed, no repeats of the overview wording),',
  'decisions (key decisions actually stated or agreed),',
  'openQuestions (questions left unresolved; empty when there are none),',
  'nextSteps (next steps stated),',
  'proposedActions (array of {action, owner, due}) where each action is a concrete, actionable follow-up stated or clearly agreed in the transcript;',
  'owner is the person the transcript names for it, otherwise null; due is the timing exactly as the transcript states it (for example "by Friday" or "October 15"), otherwise null.',
  'Do not repeat the same point across lists. Do not pad lists; each may be empty. Keep every list item short and factual.',
].join(' ')

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class SummaryUnavailable extends Error {}

const stringList = { type: 'ARRAY', items: { type: 'STRING' } }
/** The exact answer shape, so Gemini's JSON mode cannot wander or run on. */
export const GEMINI_SUMMARY_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    overview: { type: 'STRING' },
    discussion: stringList,
    decisions: stringList,
    openQuestions: stringList,
    nextSteps: stringList,
    proposedActions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { action: { type: 'STRING' }, owner: { type: 'STRING', nullable: true }, due: { type: 'STRING', nullable: true } },
        required: ['action'],
      },
    },
  },
  required: ['overview', 'discussion', 'decisions', 'openQuestions', 'nextSteps', 'proposedActions'],
}

/** Keeps a well-formed answer within the stored limits instead of rejecting it for being long. */
export function normalizeSummary(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, unknown>
  // Only trim answers that already have the right shape; anything else is rejected by the schema.
  const keys = ['discussion', 'decisions', 'openQuestions', 'nextSteps', 'proposedActions']
  if (!keys.every((k) => Array.isArray(r[k]))) return raw
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim().slice(0, 600))
      .slice(0, 25)
  const actions = (Array.isArray(r.proposedActions) ? r.proposedActions : [])
    .filter((a): a is { action: unknown; owner?: unknown; due?: unknown } => Boolean(a) && typeof a === 'object' && typeof (a as { action?: unknown }).action === 'string')
    .map((a) => ({
      action: String(a.action).trim().slice(0, 300),
      owner: typeof a.owner === 'string' && a.owner.trim() ? a.owner.trim().slice(0, 120) : null,
      due: typeof a.due === 'string' && a.due.trim() ? a.due.trim().slice(0, 120) : null,
    }))
    .filter((a) => a.action.length >= 3)
    .slice(0, 15)
  // Drop exact repeats inside a list (models sometimes echo a point twice).
  const unique = (items: string[]) => items.filter((item, i) => items.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === i)
  const overview = typeof r.overview === 'string' ? r.overview.trim().slice(0, 2400) : ''
  return {
    overview,
    discussion: unique(list(r.discussion)),
    decisions: unique(list(r.decisions)),
    openQuestions: unique(list(r.openQuestions)),
    nextSteps: unique(list(r.nextSteps)),
    proposedActions: actions.filter((a, i) => actions.findIndex((x) => x.action.toLowerCase() === a.action.toLowerCase()) === i),
  }
}

export async function summarizeTranscript(transcript: string, fetchImpl: FetchLike = httpsFetch): Promise<{ summary: ParsedSummary; provider: string; truncated: boolean }> {
  const provider = meetingSummaryProvider()
  if (!provider) throw new SummaryUnavailable('No AI summary service is configured for this CRM.')
  const text = transcript.trim()
  if (!text) throw new Error('The transcript is empty.')
  const truncated = text.length > SUMMARY_MAX_CHARS
  const userText = `TRANSCRIPT:\n${text.slice(0, SUMMARY_MAX_CHARS)}`
  let content: string
  if (geminiConfigured()) {
    content = await geminiGenerate(
      { system: SYSTEM, user: userText, json: true, schema: GEMINI_SUMMARY_SCHEMA, thinking: 'minimal', maxOutputTokens: 8192 },
      fetchImpl,
    )
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
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""))
  } catch {
    throw new Error('The AI service returned an unreadable summary.')
  }
  const checked = summarySchema.safeParse(normalizeSummary(parsed))
  if (!checked.success) throw new Error('The AI service returned a summary in the wrong shape.')
  return { summary: checked.data, provider, truncated }
}
