# TheNetTicket production bug audit

**Target:** https://ticket.thenetvr.com  
**Audited:** 2026-09-21  
**Scope:** Public pages + unauthenticated `/dashboard` and `/scan` flows  
**Repo note:** This workspace (`sammyyyy`) does **not** contain the TheNetTicket source. Fixes below are ready-to-apply recipes for the Nuxt app that deploys to `ticket.thenetvr.com`.

---

## Summary

| ID | Severity | Bug | Status |
|----|----------|-----|--------|
| B1 | Critical | PWA/Workbox: `/scan` is navigateFallback but not precached → console error + wrong page content | Confirmed |
| B2 | Critical | Production ships `public.appUrl = "http://localhost:3000"` | Confirmed |
| B3 | High | `/scan` is client-only (`ssr: false`) and inconsistently gated vs `/dashboard` | Confirmed |
| B4 | Medium | Unauthenticated `/api/seller/*` calls from scanner UI | Confirmed |

Working correctly: homepage CTAs, Clerk sign-in/sign-up, `/dashboard` auth redirect, legal pages, mobile layout (375px).

---

## B1 — Service worker `/scan` navigateFallback without precache (Critical)

### Evidence

- Live `sw.js` registers:

```js
createHandlerBoundToURL("/scan")
// allowlist: /^\/scan/
```

- Precache manifest lists `_nuxt/*` assets + fonts + `manifest.webmanifest`, but **not** the `/scan` HTML document.
- Console on load:

```text
Uncaught (in promise) non-precached-url: non-precached-url :: [{"url":"/scan"}]
  at O.createHandlerBoundToURL (workbox-*.js)
  at sw.js
```

- Direct navigation to `https://ticket.thenetvr.com/scan` is **intermittent**: sometimes the Gate scanner UI loads (client hydration), sometimes the **marketing homepage** renders while the URL stays `/scan` (SW/shell mismatch after the Workbox error).

SSR for `/scan` confirms client-only shell:

```html
data-ssr="false"
<!-- empty #__nuxt, no title -->
```

### Recommended fix (Nuxt PWA / `@vite-pwa/nuxt`)

Either **precache the scan HTML**, or **stop using `/scan` as navigateFallback**.

**Option A — include fallback in precache (preferred for offline gate scanner):**

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  pwa: {
    strategies: 'generateSW',
    registerType: 'autoUpdate',
    manifest: {
      name: 'TheNetTicket Gate Scanner',
      short_name: 'Gate Scanner',
      start_url: '/scan',
      display: 'standalone',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
    },
    workbox: {
      // Must match createHandlerBoundToURL target
      navigateFallback: '/scan',
      navigateFallbackAllowlist: [/^\/scan/],
      // Ensure the HTML document is generated + cached
      additionalManifestEntries: [{ url: '/scan', revision: null }],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,wasm,webmanifest}'],
    },
  },
  routeRules: {
    // Prefer SSR or at least prerender so /scan HTML exists as a real file/route
    '/scan': { ssr: true, prerender: true },
  },
})
```

**Option B — disable broken navigateFallback until offline shell is ready:**

```ts
workbox: {
  navigateFallback: undefined,
  navigateFallbackAllowlist: [],
}
```

Also unregister old SWs after deploy (users may keep a broken worker until refresh/`skipWaiting`).

### Verify

1. Hard-refresh, Application → Service Workers → unregister, reload.
2. Open `/scan` — no `non-precached-url` error.
3. Offline + installed PWA still opens scanner shell.

---

## B2 — `appUrl` hardcoded to localhost in production (Critical)

### Evidence

Every page’s inline Nuxt config includes:

```js
window.__NUXT__.config = {
  public: {
    appUrl: "http://localhost:3000",
    clerk: { publishableKey: "pk_live_…", … }
  }
}
```

Confirmed on `/`, `/scan`, `/dashboard`, `/sign-in`.

### Recommended fix

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  },
})
```

Production env (AWS/SSM/Secrets, CI, Amplify, etc.):

```bash
NUXT_PUBLIC_APP_URL=https://ticket.thenetvr.com
```

Ensure the **build** that uploads to S3/CloudFront runs with that env set (Nuxt inlines `public` runtime config at build time unless using Nitro runtime override correctly).

### Verify

View-source on production → search `localhost` → **0 matches**.  
`appUrl` must be `https://ticket.thenetvr.com`.

---

## B3 — `/scan` auth / SSR inconsistency vs `/dashboard` (High)

### Evidence

| Route | Unauthenticated behavior |
|-------|--------------------------|
| `/dashboard` | Server redirect → `/sign-in?redirect=/dashboard` |
| `/scan` | Client-only empty shell; homepage CTA sends users through `/sign-in?redirect=/scan`, but **direct** `/scan` does not redirect |

Homepage “Gate scanner” correctly links to sign-in; direct URL does not.

### Recommended fix

Align middleware:

```ts
// middleware/auth.global.ts (or scan-specific)
export default defineNuxtRouteMiddleware((to) => {
  const { userId } = useAuth() // clerk
  if (!userId.value && (to.path.startsWith('/dashboard') || to.path === '/scan')) {
    return navigateTo({ path: '/sign-in', query: { redirect: to.fullPath } })
  }
})
```

If offline mode must allow `/scan` without network auth, gate API calls behind “signed in OR cached event present”, and show an explicit offline/sign-in empty state instead of calling `/api/seller/events` immediately.

Enable SSR for `/scan` so first paint matches auth decision (see B1 `routeRules`).

---

## B4 — Scanner fires seller APIs while signed out (Medium)

### Evidence

Unauthenticated visit to `/scan` (when shell loads) issues `GET /api/seller/events` → auth failure (401 in browser / 404+Clerk signed-out from API gateway).

### Recommended fix

```ts
// only fetch after Clerk session is ready + signed in
const { isSignedIn, isLoaded } = useAuth()
watchEffect(() => {
  if (!isLoaded.value) return
  if (!isSignedIn.value) return
  refreshEvents()
})
```

---

## Pages checked

- `/` — OK  
- `/sign-in`, `/sign-up` — Clerk OK  
- `/dashboard` — redirect OK  
- `/scan` — B1/B3/B4  
- `/legal/terms|privacy|refunds` — OK  
- `/nonexistent` — custom 404 OK  
- Mobile 375px homepage + sign-in — OK  

Authenticated dashboard deep links (`/dashboard/events/:id`, etc.) were **not** tested (no venue credentials in this environment).

---

## Blocker for applying fixes here

Connected GitHub repo `samadalam481470sa-cmd/sammyyyy` only contains `README.md`.  
TheNetTicket source is not in this workspace and was not found under public `thenetvr/*` repos.

**To land production fixes:** reconnect this agent to the Nuxt TheNetTicket repository (or grant access), then apply B1–B4 and redeploy the CloudFront/S3 build.
