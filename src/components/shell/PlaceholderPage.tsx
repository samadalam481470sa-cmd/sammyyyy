import { Link } from "react-router-dom"

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="card mx-auto max-w-2xl px-8 py-10">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Coming later</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{description}</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800"
      >
        Back to dashboard
      </Link>
    </section>
  )
}
