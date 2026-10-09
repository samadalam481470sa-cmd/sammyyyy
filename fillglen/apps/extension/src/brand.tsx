export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="fg-logo">
      <rect width="32" height="32" rx="8" fill="#1b3a2f" />
      <path d="M6 22c4-8 6-12 10-12s6 4 10 12" fill="none" stroke="#e8c9a8" strokeWidth="2" />
      <path d="M8 22h16" stroke="#d9763a" strokeWidth="2" />
      <circle cx="16" cy="12" r="2" fill="#f6f1e8" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="fg-wordmark">
      <Logo size={40} />
      <div>
        <strong>Fillglen</strong>
        <span>Texas IT jobs · tailored to your resume</span>
      </div>
    </div>
  );
}

export function CopyrightNotice() {
  return (
    <footer className="fg-legal">
      <Logo size={18} />
      <p>
        © {new Date().getFullYear()} Fillglen. All rights reserved. This interface, software, and related content are
        protected by copyright. Unauthorized copying, scraping, or redistribution is prohibited.
      </p>
    </footer>
  );
}
