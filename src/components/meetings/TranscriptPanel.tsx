import { useEffect, useRef } from 'react'
import { Captions, Copy, Sparkles } from 'lucide-react'
import type { TranscriptLine } from '@/types/meetings'

interface TranscriptPanelProps {
  lines: TranscriptLine[]
  interim?: string
  live: boolean
  status: string
  summary: string
  onSummarize: () => void
  onCopy: () => void
}

export function TranscriptPanel({
  lines,
  interim,
  live,
  status,
  summary,
  onSummarize,
  onCopy,
}: TranscriptPanelProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lines, interim])

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Captions className="h-4 w-4 text-accent" />
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Live transcript</h3>
            <p className="text-[11px] text-ink-subtle">{status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-attention-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-attention uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-attention" />
              Capturing
            </span>
          )}
          <button
            type="button"
            onClick={onSummarize}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-canvas"
            title="Generate CRM summary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Summarize
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-canvas"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>

      <div className="custom-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !interim && (
          <p className="py-8 text-center text-sm text-ink-muted">
            Start a face call or phone session to capture captions into the CRM — Teams-style continuous
            transcription.
          </p>
        )}
        {lines.map((line) => (
          <div key={line.id} className="rounded-lg bg-canvas px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                {line.speaker}
              </span>
              <span className="font-mono text-[10px] text-ink-subtle">
                {new Date(line.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{line.text}</p>
          </div>
        ))}
        {interim && (
          <div className="rounded-lg border border-dashed border-accent/40 bg-accent-soft/40 px-3 py-2">
            <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">Interim</span>
            <p className="mt-0.5 text-sm italic text-ink-muted">{interim}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {summary && (
        <div className="border-t border-border bg-canvas px-4 py-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
            CRM summary
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{summary}</p>
        </div>
      )}
    </div>
  )
}
