"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { clsx } from "clsx";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Executive overview",
    hint: "Platform and pipeline at a glance",
  },
  {
    href: "/pipeline",
    label: "M&A pipeline",
    hint: "Targets in market, Best in Class screening",
  },
  {
    href: "/portfolio",
    label: "Aggregated portfolio",
    hint: "The one platform view of acquired MGAs",
  },
  {
    href: "/synergies",
    label: "Synergy analysis",
    hint: "Overlaps, white space and cross-sell",
  },
  {
    href: "/agencies",
    label: "Retail agencies",
    hint: "Every retailer, by MGA",
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-navy-800 bg-navy-950 px-4 py-3 lg:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="rounded-md border border-navy-700 px-3 py-1.5 text-xs font-semibold text-navy-100"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-b border-navy-800 bg-navy-950 px-3 py-3 lg:hidden"
        >
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(pathname, item.href)
                      ? "bg-navy-800 text-white"
                      : "text-navy-200 hover:bg-navy-900 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-navy-800 bg-navy-950 lg:flex">
        <div className="px-5 py-5">
          <BrandMark />
        </div>
        <nav className="flex-1 px-3 pb-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "block rounded-lg px-3 py-2.5 transition-colors",
                      active
                        ? "bg-navy-800 text-white"
                        : "text-navy-200 hover:bg-navy-900 hover:text-white",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span
                      className={clsx(
                        "mt-0.5 block text-[11px] leading-snug",
                        active ? "text-navy-200" : "text-navy-400",
                      )}
                    >
                      {item.hint}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-navy-800 px-5 py-4">
          <p className="text-[11px] leading-relaxed text-navy-400">
            Working build for review. Data is illustrative — see{" "}
            <span className="font-mono text-navy-300">docs/SCHEMA.md</span> for
            the fields still open for sign-off.
          </p>
        </div>
      </aside>
    </>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold tracking-tight text-white ring-1 ring-white/15">
        NSP
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">
          Newport Specialty Partners
        </span>
        <span className="block truncate text-[11px] text-navy-300">
          MGA platform &amp; corp dev
        </span>
      </span>
    </Link>
  );
}
