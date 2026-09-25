import { useState, type FormEvent } from 'react'
import { SendHorizonal, Sparkles } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian',
]

/**
 * UI prototype for the Newport AI assistant.
 *
 * `submitPrompt` is the future integration point: replace its stub body with a
 * call to the AI backend and render streamed responses in place of the notice.
 * No external AI API is connected in this sprint.
 */
export function NewportAI() {
  const [prompt, setPrompt] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)

  const submitPrompt = (value: string) => {
    if (!value.trim()) return
    setSubmitted(value.trim())
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submitPrompt(prompt)
  }

  return (
    <section className="rounded-xl border border-navy-100 bg-gradient-to-br from-navy-50/80 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-accent-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-[15px] font-semibold text-navy-900">Newport AI</h2>
        <span className="ml-auto rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-600">
          Preview
        </span>
      </div>

      <form onSubmit={handleSubmit} className="relative mt-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about your acquisition pipeline..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-100"
        />
        <button
          type="submit"
          aria-label="Ask Newport AI"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-navy-900 text-white transition-colors hover:bg-navy-700"
        >
          <SendHorizonal className="h-3.5 w-3.5" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setPrompt(suggestion)
              submitPrompt(suggestion)
            }}
            className="rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[11px] font-medium text-navy-700 transition-colors hover:border-navy-300 hover:bg-navy-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="mt-3 rounded-lg border border-navy-100 bg-white px-3 py-2.5 text-xs text-slate-500">
          <span className="font-medium text-navy-800">“{submitted}”</span> — Newport AI responses
          will be connected in a future sprint.
        </div>
      )}
    </section>
  )
}
