import Link from "next/link";
import { getAllMetrics } from "@/lib/metrics";

export default function HomePage() {
  const pipeline = getAllMetrics("pipeline");
  const acquired = getAllMetrics("acquired");

  return (
    <div className="animate-rise">
      <section className="relative overflow-hidden rounded-2xl border border-line/70 bg-ink px-6 py-12 text-paper sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, #1f6f78 0%, transparent 55%), linear-gradient(135deg, transparent 40%, #9a734833 100%)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-paper/55">
            Insurance PE Roll-Up CRM
          </p>
          <h2 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
            Newport Specialty Partners
          </h2>
          <p className="mt-4 text-base text-paper/75 sm:text-lg">
            Centralized platform to track, acquire, and manage MGAs — and
            surface synergies across the aggregated portfolio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pipeline"
              className="rounded-md bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-fog"
            >
              Open M&A Pipeline
            </Link>
            <Link
              href="/portfolio"
              className="rounded-md border border-paper/30 px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-paper/10"
            >
              View One Platform
            </Link>
            <Link
              href="/schema"
              className="rounded-md border border-paper/30 px-4 py-2.5 text-sm font-semibold text-paper/80 transition hover:bg-paper/10"
            >
              Review schema with Mary
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/pipeline"
          className="group rounded-xl border border-line/80 bg-paper/70 p-6 transition hover:border-teal/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">
            Pipeline
          </p>
          <p className="font-display mt-1 text-3xl font-semibold text-ink">
            {pipeline.length}
          </p>
          <p className="mt-1 text-sm text-muted">
            Prospect MGAs in market — filter for Best-in-Class metrics.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-teal group-hover:underline">
            Go to pipeline →
          </span>
        </Link>
        <Link
          href="/portfolio"
          className="group rounded-xl border border-line/80 bg-paper/70 p-6 transition hover:border-teal/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">
            On-Platform
          </p>
          <p className="font-display mt-1 text-3xl font-semibold text-ink">
            {acquired.length}
          </p>
          <p className="mt-1 text-sm text-muted">
            Acquired MGAs with overlap detection for board / PE review.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-teal group-hover:underline">
            Go to portfolio →
          </span>
        </Link>
      </section>
    </div>
  );
}
