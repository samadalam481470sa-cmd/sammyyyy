"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/pipeline", label: "M&A Pipeline" },
  { href: "/portfolio", label: "Portfolio (One Platform)" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">
            NP
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Newport Specialty Partners</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              MGA Platform &middot; Backed by Lovell Minnick
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "btn-tab",
                  active ? "btn-tab-active" : "btn-tab-inactive",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
