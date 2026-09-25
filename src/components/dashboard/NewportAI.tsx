import { CornerDownLeft, Sparkles, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { SUGGESTED_PROMPTS, askNewportAI, type AssistantReply } from '../../services/aiAssistant';
import { Card } from '../ui/Card';

interface NewportAIProps {
  context: {
    statusFilter: string;
    visibleOpportunities: number;
    needsAttention: number;
  };
}

/**
 * Prototype assistant surface. All model work happens behind
 * `askNewportAI`, so this component does not change when the service is real.
 */
export function NewportAI({ context }: NewportAIProps) {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || isPending) return;

    setIsPending(true);
    try {
      setReply(await askNewportAI({ question: trimmed, context }));
      setQuestion('');
    } finally {
      setIsPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-56 lg:shrink-0">
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-navy-800 to-accent-700 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-navy-900">Newport AI</p>
            <p className="text-[11px] text-slate-500">Pipeline assistant · preview</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <form onSubmit={onSubmit} className="relative">
            <input
              name="newport-ai-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about your acquisition pipeline..."
              aria-label="Ask Newport AI about your acquisition pipeline"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-3.5 pr-11 text-sm text-navy-900 placeholder:text-slate-400 transition-colors focus:border-accent-400 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim() || isPending}
              aria-label="Ask Newport AI"
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-navy-900 text-white transition-colors hover:bg-navy-800 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <CornerDownLeft className="size-3.5" />
            </button>
          </form>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void ask(prompt)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {reply ? (
        <div className="flex items-start gap-3 border-t border-slate-200/70 bg-slate-50/70 px-5 py-3 animate-fade-in">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{reply.question}</p>
            <p className="mt-1 text-[13px] text-navy-900">{reply.answer}</p>
          </div>
          <button
            type="button"
            onClick={() => setReply(null)}
            aria-label="Dismiss response"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </Card>
  );
}
