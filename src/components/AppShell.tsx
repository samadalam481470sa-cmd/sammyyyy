"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/pipeline", label: "M&A Pipeline" },
  { href: "/portfolio", label: "One Platform" },
  { href: "/schema", label: "Schema Wireframe" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="animate-rise mb-10 border-b border-line/70 pb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-teal">
              Backed by Lovell Minnick
            </p>
            <Link href="/" className="group block">
              <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
                Newport Specialty Partners
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
                MGA acquisition CRM — pipeline, portfolio, and synergy
                intelligence on one platform.
              </p>
            </Link>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Primary">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-paper"
                      : "bg-fog/80 text-ink-soft hover:bg-line/60"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-12 border-t border-line/60 pt-4 text-xs text-muted">
        MVP wireframe for leadership review — confirm tracked metrics before
        next build sprint.
      </footer>
    </div>
  );
}
