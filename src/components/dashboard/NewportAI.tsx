import { Sparkles } from "lucide-react"
import { useState } from "react"
import { AI_SUGGESTED_PROMPTS } from "../../data/constants.ts"
import { useCrm } from "../../context/useCrm.ts"
import { localNewportAi, type AiReply, type NewportAiClient } from "../../lib/newportAi.ts"

export function NewportAI({ client = localNewportAi }: { client?: NewportAiClient }) {
  const { snapshot, openOpportunity } = useCrm()
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [reply, setReply] = useState<AiReply | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed || pending) return
    setPending(true)
    setError(null)
    setQuestion(trimmed)
    try {
      const next = await client.ask(trimmed, { snapshot })
      setReply(next)
      setDraft("")
    } catch {
      setReply(null)
      setError("Newport AI is unavailable right now.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="card p-5" aria-labelledby="newport-ai-heading">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-100 text-navy-700">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="newport-ai-heading" className="text-[15px] font-semibold tracking-tight text-ink">
            Newport AI
          </h2>
          <p className="text-xs text-muted">Answers from the deals in this workspace. An external model is not connected.</p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void ask(draft)
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ask Newport AI</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about your acquisition pipeline..."
            className="field h-11"
          />
        </label>
        <button
          type="submit"
          disabled={pending || draft.trim().length === 0}
          className="h-11 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-default disabled:bg-navy-900/40"
        >
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {AI_SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void ask(prompt)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-medium text-navy-800 hover:bg-canvas"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {reply ? (
        <div className="mt-4 rounded-xl bg-canvas px-4 py-3">
          {question ? <p className="text-xs font-semibold tracking-wide text-muted uppercase">{question}</p> : null}
          <div className="mt-2 space-y-2">
            {reply.blocks.map((block, index) =>
              block.projectId ? (
                <button
                  key={`${block.projectId}-${index}`}
                  type="button"
                  onClick={() => openOpportunity(block.projectId as string)}
                  className="block w-full rounded-lg bg-white px-3 py-2 text-left text-sm leading-6 text-ink hover:ring-1 hover:ring-line"
                >
                  {block.text}
                </button>
              ) : (
                <p key={index} className="text-sm leading-6 text-ink">
                  {block.text}
                </p>
              ),
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
