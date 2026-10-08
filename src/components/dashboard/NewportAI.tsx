import { useState, type FormEvent } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import { askNewportAi, getStoredSession } from '@/lib/api'
import { answerFromKnowledge, type AiAnswer } from '@/lib/aiAssistant'
import { useData } from '@/data/DataContext'
import { loadDemoCollection } from '@/lib/demoStore'
import { mockTasksDb, mockContacts, mockDocuments, mockSources, mockCarriers, mockPortfolio } from '@/data/mockModules'

const SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian',
  'Pipeline overview',
] as const

/**
 * Newport AI — live assistant that searches the full CRM (opportunities,
 * tasks, relationships, documents, sources, carriers, portfolio) and answers.
 * Server uses optional OPENAI_API_KEY; otherwise retrieval synthesis runs.
 */
export function NewportAI() {
  const { opportunities } = useData()
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runLocal = (question: string): AiAnswer =>
    answerFromKnowledge(question, {
      opportunities,
      tasks: loadDemoCollection('tasks', mockTasksDb) as unknown as Array<Record<string, unknown>>,
      contacts: loadDemoCollection('contacts', mockContacts) as unknown as Array<
        Record<string, unknown>
      >,
      documents: loadDemoCollection('documents', mockDocuments) as unknown as Array<
        Record<string, unknown>
      >,
      sources: loadDemoCollection('sources', mockSources) as unknown as Array<
        Record<string, unknown>
      >,
      carriers: loadDemoCollection('carriers', mockCarriers) as unknown as Array<
        Record<string, unknown>
      >,
      portfolio: loadDemoCollection('portfolio', mockPortfolio) as unknown as Array<
        Record<string, unknown>
      >,
    })

  const handleSubmit = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed || busy) return
    setInput(trimmed)
    setBusy(true)
    setError(null)
    try {
      if (getStoredSession()?.token === 'local-demo') {
        setAnswer(runLocal(trimmed))
      } else {
        try {
          const result = await askNewportAi(trimmed)
          setAnswer(result)
        } catch {
          setAnswer(runLocal(trimmed))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant failed')
    } finally {
      setBusy(false)
    }
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSubmit(input)
  }

  return (
    <section className="rounded-xl border border-border bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white shadow-(--shadow-card)">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/25">
          <Sparkles className="h-4 w-4 text-accent-soft" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-brand text-lg font-semibold tracking-tight">Newport AI</h2>
          <p className="text-xs text-white/55">
            Pipeline assistant · searches the full CRM
            {answer?.mode === 'llm' ? ' · LLM' : ''}
          </p>
        </div>
      </div>

      <form onSubmit={onFormSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about deals, diligence, relationships, documents…"
          className="h-11 w-full rounded-lg border border-white/10 bg-white/10 pr-11 pl-3.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-accent focus:ring-2 focus:ring-accent/30"
          aria-label="Ask Newport AI"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          aria-label="Send"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit(prompt)}
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/85">
          <div className="whitespace-pre-wrap">
            {answer.answer.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={i} className="font-semibold text-white">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </div>
          {answer.sources.length > 0 && (
            <p className="mt-2 border-t border-white/10 pt-2 text-[10px] tracking-wide text-white/45 uppercase">
              Sources:{' '}
              {answer.sources
                .slice(0, 6)
                .map((s) => `${s.type}:${s.label}`)
                .join(' · ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
