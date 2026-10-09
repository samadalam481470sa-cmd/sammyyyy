export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1b3a2f" />
      <path d="M6 22c4-8 6-12 10-12s6 4 10 12" fill="none" stroke="#e8c9a8" strokeWidth="2" />
      <path d="M8 22h16" stroke="#d9763a" strokeWidth="2" />
      <circle cx="16" cy="12" r="2" fill="#f6f1e8" />
    </svg>
  );
}

export function CopyrightNotice() {
  return (
    <footer className="mt-10 pt-5 border-t border-[#d9d0c4] text-xs text-[#5c6b64] flex gap-3 items-start max-w-3xl">
      <Logo size={18} />
      <p>
        © {new Date().getFullYear()} Fillglen. All rights reserved. This interface, software, and related content are
        protected by copyright. Unauthorized copying, scraping, or redistribution is prohibited.
      </p>
    </footer>
  );
}
