import { Link } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface px-6 py-5 lg:px-8">
        <h1 className="font-brand text-2xl font-bold text-navy-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">Module placeholder for a future sprint</p>
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-(--shadow-card)">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Construction className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h2 className="font-brand text-xl font-bold text-navy-900">{title}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            This module will be implemented in a future sprint. The Dashboard remains the active
            workspace for this release.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
