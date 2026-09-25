import { useState } from 'react';
import { Sparkles, ArrowUp } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Which deals need attention?',
  'What changed this week?',
  'Show active deals with no next action',
  'Summarize Project Guardian',
];

/**
 * UI-only prototype of the Newport AI assistant. `onAsk` is a stub for now;
 * a future sprint wires this to a real assistant/LLM backend without
 * changing this component's contract.
 */
export default function NewportAI() {
  const [query, setQuery] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const handleAsk = (prompt: string) => {
    if (!prompt.trim()) return;
    setPendingPrompt(prompt);
    setQuery('');
  };

  return (
    <section className="card-shadow rounded-xl border border-navy-800 bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-400/20 text-accent-300">
          <Sparkles size={15} />
        </span>
        <h2 className="text-base font-semibold">Newport AI</h2>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-200">
          Preview
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(query);
        }}
        className="mt-3 flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 focus-within:border-accent-400/60"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your acquisition pipeline..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-500 text-white transition-colors hover:bg-accent-400 disabled:opacity-40"
          disabled={!query.trim()}
          aria-label="Ask Newport AI"
        >
          <ArrowUp size={14} />
        </button>
      </form>

      {pendingPrompt && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200">
          <span className="text-accent-200">&ldquo;{pendingPrompt}&rdquo;</span>
          <p className="mt-1 text-xs text-slate-400">
            Newport AI will analyze your pipeline and respond here in a future sprint.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleAsk(prompt)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-accent-400/50 hover:bg-white/10"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
