import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Remove inner body padding (e.g. for tables and lists that go edge-to-edge). */
  flush?: boolean
}

/** Salesforce Lightning card: square corners, hairline border, gray header strip. */
export function Card({ title, subtitle, actions, children, className = '', flush = false }: CardProps) {
  return (
    <section
      className={`rounded-[4px] border border-line bg-white shadow-[0_2px_2px_rgba(0,0,0,0.05)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#fafaf9] px-4 py-2.5">
          <div>
            {title && <h2 className="text-[13px] font-bold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? '' : 'px-4 py-3.5'}>{children}</div>
    </section>
  )
}
