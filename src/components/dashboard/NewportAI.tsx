import { useState, type FormEvent } from 'react'
import { SendHorizonal, Sparkles } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian',
]

/**
 * UI prototype for the Newport AI assistant, styled like an in-app assistant panel.
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
    <section className="overflow-hidden rounded-[4px] border border-line bg-white shadow-[0_2px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2 border-b border-line bg-[#f4f8fe] px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[13px] font-bold text-ink">Newport AI</h2>
        <span className="ml-auto rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-700 uppercase">
          Preview
        </span>
      </div>

      <div className="px-4 py-3">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about your acquisition pipeline..."
            className="h-9 w-full rounded-[4px] border border-[#c9c9c9] bg-white pl-3 pr-10 text-[13px] text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            aria-label="Ask Newport AI"
            className="absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[4px] bg-brand-500 text-white transition-colors hover:bg-brand-600"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setPrompt(suggestion)
                submitPrompt(suggestion)
              }}
              className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {submitted && (
          <div className="mt-3 rounded-[4px] border border-line bg-canvas px-3 py-2.5 text-xs text-muted">
            <span className="font-semibold text-ink">“{submitted}”</span> — Newport AI responses
            will be connected in a future sprint.
          </div>
        )}
      </div>
    </section>
  )
}
