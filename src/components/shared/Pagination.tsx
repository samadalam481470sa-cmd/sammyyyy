import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '@/lib/paginate'

interface PaginationProps {
  page: number
  pageCount: number
  start: number
  end: number
  total: number
  onPage: (page: number) => void
  /** Plural noun for the range text, e.g. "opportunities". */
  noun?: string
  testId?: string
}

/** Footer: "Showing X–Y of Z", previous and next arrows, and numbered pages. */
export function Pagination({ page, pageCount, start, end, total, onPage, noun = 'records', testId }: PaginationProps) {
  const go = (next: number) => {
    if (next < 1 || next > pageCount || next === page) return
    onPage(next)
  }
  return (
    <nav
      aria-label="Pagination"
      data-testid={testId}
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-5 py-2.5 text-xs text-ink-muted"
    >
      <p aria-live="polite">
        {total === 0 ? `No ${noun}` : `Showing ${start}–${end} of ${total} ${noun}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(page, pageCount).map((n, index) =>
          n == null ? (
            <span key={`gap-${index}`} className="px-1 text-ink-subtle" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={`h-8 min-w-8 rounded-lg px-2 font-semibold ${
                n === page ? 'bg-navy-900 text-white' : 'border border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
