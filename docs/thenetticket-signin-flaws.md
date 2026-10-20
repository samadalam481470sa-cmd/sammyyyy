# TheNetTicket — flaws in `/sign-in?redirect=/dashboard`

**Target:** https://ticket.thenetvr.com/sign-in?redirect=/dashboard  
**Audited:** 2026-10-20  
**Method:** black-box HTTP + Chromium. No seller credentials used.

---

## Critical

### 1. Open redirect / post-login phishing via `redirect` query param

The sign-in page takes `?redirect=` from the URL and passes it **unsanitized** into Clerk as `fallback-redirect-url` (and `sign-up-fallback-redirect-url`).

Decompiled page chunk `/_nuxt/Dz2b3-ej2.js`:

```js
let p = computed(() => route.query.redirect || `/dashboard`)
// ...
<SignIn
  :fallback-redirect-url="p"
  :sign-up-fallback-redirect-url="p"
  sign-up-url="/sign-up"
/>
```

**Proof (browser hook on `Clerk.mountSignIn`):**

```json
{
  "path": "/sign-in",
  "fallbackRedirectUrl": "https://evil.example/steal-session",
  "signUpFallbackRedirectUrl": "https://evil.example/steal-session",
  "signUpUrl": "/sign-up",
  "routing": "path"
}
```

Reproduce:

```
https://ticket.thenetvr.com/sign-in?redirect=https://evil.example/steal-session
```

Same bug on sign-up (`/_nuxt/hZ_KaKYZ2.js`).

**Impact:** Attacker sends a venue owner a lookalike “please sign in” link. After a successful Clerk login, the app asks Clerk to send them to the attacker’s URL. That is classic post-auth phishing (credential reuse / session fixation adjacent UX). Relative paths like `/dashboard` are fine; absolute and protocol-relative values must be rejected in app code (and allowlisted in the Clerk dashboard).

**Fix:** Only accept same-origin relative paths:

```ts
function safeRedirect(raw: unknown): string {
  if (typeof raw !== 'string') return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}
```

Also configure Clerk **Allowed redirect URLs** to `https://ticket.thenetvr.com/*` only.

---

## High

### 2. Production still ships `appUrl: "http://localhost:3000"`

Every page’s runtime config, including sign-in, contains:

```js
public: { appUrl: "http://localhost:3000", clerk: { publishableKey: "pk_live_…" } }
```

Confirmed in the browser on the sign-in URL. Absolute links built server-side (ticket emails, Stripe return URLs, QR payloads, canonical URLs) can point at a host the buyer cannot reach.

**Fix:** `NUXT_PUBLIC_APP_URL=https://ticket.thenetvr.com` in the deployed env; fail boot if `appUrl` is localhost outside development.

### 3. `/scan` still renders for signed-out visitors (cold load)

| Route | Signed-out response |
| --- | --- |
| `/dashboard` | `302 → /sign-in?redirect=/dashboard` |
| `/scan` | `200`, `data-ssr="false"`, UI: “Set up this gate” |

Browser (signed out) stayed on `/scan` with title “Gate scanner · TheNetTicket” and the setup UI — **no redirect to sign-in**. Gate devices open `/scan` from bookmarks / PWA `start_url`; this is the path that fails.

**Fix:** Server-side guard for `/scan` matching `/dashboard`, or stop marking it `ssr: false` without a server middleware redirect.

---

## Medium

### 4. No Content-Security-Policy on HTML responses

Sign-in, home, and dashboard HTML responses have **no CSP** header (API JSON responses sometimes set a restrictive one). Combined with a live `pk_live_` Clerk key and third-party scripts, XSS blast radius is larger than it needs to be.

### 5. Sign-in page trusts query string for post-auth navigation with empty Clerk force/fallback defaults

Runtime config on the live site:

```text
signInFallbackRedirectUrl: ""
signInForceRedirectUrl: ""
```

So the only post-login destination control in practice is the attacker-influenced `?redirect=` prop above.

---

## Notes on what is *not* broken here

- `/dashboard*` correctly 302s to `/sign-in?redirect=…` when signed out.
- WAF/CloudFront returns **403** for some obvious XSS probes in `redirect` (`javascript:…`, raw `<script>`), but **allows** `https://evil.example/...` and `//evil.example/...`.
- Buyers do not use this sign-in page (copy says “Buyers never need an account”) — the victims of finding #1 are **venue owners/staff**, which is still high impact for a ticketing platform.

---

## Evidence files

| File | What |
| --- | --- |
| `artifacts/signin-audit/clerk-mount-props.json` | Hooked `mountSignIn` props with evil URL |
| `artifacts/signin-audit/signin-evil-https.png` | Page loaded with external redirect |
| `artifacts/signin-audit/scan-cold.png` | Signed-out gate scanner UI |
| `artifacts/signin-audit/sign-in-page.js` | Decompiled page source |
| `artifacts/signin-audit/browser-findings.json` | Full browser run |
