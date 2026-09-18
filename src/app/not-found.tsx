import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        Not on the platform
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        No MGA, program or retail agency matches that address. It may have been
        renamed, or the record may not exist in this build yet.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-lg bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700"
        >
          Executive overview
        </Link>
        <Link
          href="/pipeline"
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
        >
          M&amp;A pipeline
        </Link>
      </div>
    </div>
  );
}
