# TheNetTicket — live site bug report

Target: `https://ticket.thenetvr.com` (Nuxt 4 + Nuxt UI + Clerk, behind CloudFront)
Audited: 21 Sep 2026, build `804dadf8-ce60-46c5-9df6-2f3c572fc4f5`
Method: black box. HTTP responses, the rendered DOM in a real Chromium, the browser console,
the generated service worker, and the runtime config the server serialises into every page.
No venue credentials and no repository access were used.

Everything below is reproduced automatically by `node audit.mjs` in this directory, except
the last item, which came from reading the deployed JavaScript bundle.

| Severity | Failing checks |
| --- | --- |
| High | 5 |
| Medium | 8 |
| Low | 10 |

Two of the five high-severity checks describe one defect from both ends (the broken behaviour and
its cause in the service worker), so the high band is four distinct bugs.

---

## High

### 1. The gate scanner does not work offline, which is the product's headline promise

Checks: `offline-reload-broken-scan` (the behaviour), `sw-navigation-fallback-not-precached` (the cause)

The home page says: *"Works offline at the door — each ticket carries a signature. A phone that
has loaded the event can check it with no signal at all."* It does not survive losing signal.

Reproduction: load `/scan` on a phone-sized viewport, wait for the service worker to take
control, turn the network off, reload.

- The service worker is installed and controlling the page (`/sw.js`, cache
  `workbox-precache-v2-https://ticket.thenetvr.com/`).
- The reload fails outright with `net::ERR_INTERNET_DISCONNECTED` and renders an empty document.

Root cause, from `/sw.js`:

```js
precacheAndRoute([/* 85 entries, all _nuxt/* assets + manifest.webmanifest */], {});
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/scan"), { allowlist: [/^\/scan/] }));
```

The navigation fallback is bound to `/scan`, but `/scan` is never precached. The precache
manifest holds 85 entries and **zero HTML documents** — consistent with
`/_nuxt/builds/meta/<buildId>.json` reporting `"prerendered": []`. In a production Workbox build
the missing-URL assertion is compiled out, so nothing fails loudly at install time: the handler
simply falls through to the network, and offline navigation dies.

Fix: precache the document the fallback resolves to. Either prerender the scanner shell —
`routeRules: { '/scan': { prerender: true } }`, which puts the HTML into the Workbox manifest —
or add a dedicated prerendered offline shell and bind the `NavigationRoute` to that instead.
Then add "reload the scanner with the network off" to the release checklist, because a
registered service worker on its own proves nothing.

### 2. Production runtime config points at `http://localhost:3000`

Check: `runtime-config-appurl-mismatch`

Every server-rendered page contains:

```js
window.__NUXT__.config = { public: { appUrl: "http://localhost:3000", clerk: { publishableKey: "pk_live_…" } } }
```

This is the live deployment (`pk_live_…`) serialising a localhost `appUrl`. Nuxt serialises
`runtimeConfig.public` from the server's own resolved config, so the server is running with that
value too. Nothing in the client bundle reads `appUrl`, which means it is consumed server-side —
exactly where absolute URLs get built: ticket links in confirmation email, Stripe
`success_url` / `cancel_url`, QR payloads, canonical and social URLs. Any of those that ship today
point at a host the buyer's phone cannot reach.

Fix: set `NUXT_PUBLIC_APP_URL=https://ticket.thenetvr.com` in the deployed environment, and fail
the boot when `appUrl` resolves to localhost outside development so this cannot ship again.

### 3. `/scan` renders for signed-out visitors and then quietly does nothing

Checks: `unprotected-route-scan`, `swallowed-api-error-scan`

`/scan` returns HTTP 200 to a signed-out visitor and renders the full "Set up this gate" screen.
Its own data call, `GET /api/seller/events`, is correctly rejected with 401 — so the event picker
is empty, the "Cache event for offline scanning" button is disabled, and nothing explains why.
The home page links to `/scan` publicly ("Gate scanner"), so this is the first thing gate staff
hit before signing in.

`/dashboard` gets this right: it answers `302 → /sign-in?redirect=/dashboard` from the server.
`/scan` is only guarded on the client, by the `seller` route middleware:

```js
export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded.value && !isSignedIn.value) {
    return navigateTo(`/sign-in?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
```

The guard is a no-op whenever `isLoaded` is still false, which is the case on a cold load, and
route middleware does not re-run when `isLoaded` later flips to true. So the visitor is stranded
on a page that cannot work.

Fix: protect `/scan` server-side, the way `/dashboard` already is, so the redirect happens before
any HTML is produced. Keep the client middleware as a second line of defence, but make it wait
for Clerk to finish loading instead of skipping the check.

### 4. `/scan` never links the web app manifest, so the scanner cannot be installed

Check: `pwa-manifest-not-linked-scan`

`https://ticket.thenetvr.com/manifest.webmanifest` exists and is clearly meant for this page:

```json
{ "name": "TheNetTicket Gate Scanner", "short_name": "Gate Scanner", "start_url": "/scan",
  "display": "standalone", "orientation": "portrait", "lang": "en" }
```

No page emits `<link rel="manifest">` — not `/`, and not `/scan` itself. Without that link the
browser never offers "Add to Home Screen", so the scanner can only run as a browser tab: no
standalone window, no portrait lock, no launch icon for staff at the gate.

`/scan` is declared with `definePageMeta({ layout: false, middleware: 'seller' })`, so whatever
head configuration the shared layout provides never reaches it.

Fix: emit the manifest link from `app.head` in `nuxt.config.ts` so it is present on every route
regardless of layout.

---

## Medium

### 5. Brand green fails colour contrast everywhere it carries text

Check: `a11y-color-contrast`

`--ui-primary` resolves to `green-500` (`#00c950`) in light mode, and it is used both as text
colour and as a button fill:

| Element | Colours | Ratio | Needs |
| --- | --- | --- | --- |
| "Venue sign in" nav button | `#00c950` on `#ffffff` | 2.23:1 | 4.5:1 |
| "Open venue dashboard" primary CTA | `#ffffff` on `#00c950` | 2.21:1 | 4.5:1 |
| "Gate scanner" soft button | `#00c950` on `#e1faee` | 2.03:1 | 4.5:1 |
| Inline legal links | `#00c950` on `#ffffff` | 2.23:1 | 4.5:1 |
| "Choose an event" placeholder | `#90a1b9` on `#ffffff` | 2.63:1 | 4.5:1 |

Every primary call to action on the marketing page fails WCAG AA. Note that moving one step to
`green-600` (`#00a63e`, 3.22:1) is **not** enough — `green-700` (`#008236`) is the first shade
that passes at 4.95:1.

Fix: map `--ui-primary` to `green-700` or darker for light mode text and fills, and stop using
`text-dimmed` (slate-400) for placeholder text; slate-500 is the first passing shade at 4.76:1.

### 6. `<html>` has no `lang` attribute on any page

WCAG 3.1.1 (Level A). Screen readers fall back to the OS locale to choose pronunciation. The web
manifest already declares `"lang": "en"`, so the intent is unambiguous.

Fix: `app: { head: { htmlAttrs: { lang: 'en' } } }` in `nuxt.config.ts`.

### 7. The event picker on `/scan` has no accessible name

```html
<button role="combobox" aria-controls="reka-select-content-v-0-0" aria-expanded="false">
  <span data-slot="placeholder" class="truncate text-dimmed">Choose an event</span>
</button>
```

A `role="combobox"` element does not take its accessible name from its contents, so the visible
"Choose an event" text does not name it, and there is no `aria-label`, `aria-labelledby` or
associated `<label>`. This is the only control on the screen, and it is the one gate staff must
use before a shift.

Fix: pass `aria-label="Choose an event"` to the `USelect` (or wrap it in a `UFormField` with a
real label).

### 8. Buyer-facing failures render the stock framework error page

| URL | `document.title` |
| --- | --- |
| `/venue/<unknown>/<unknown>` | `404 - Event not found \| Nuxt` |
| `/tickets/<unknown-token>` | `404 - Tickets not found \| Nuxt` |

The body is the default Nuxt screen: a big "404", the raw message, and "Go back home" — no
header, no footer, no brand. These are exactly the URLs a buyer reaches with a stale link or a
mistyped slug, and an expired ticket link is a support call, not a 404.

Fix: add an `error.vue` that keeps the site chrome and explains the next step ("this ticket link
has expired — ask the venue to resend it").

### 9. No Open Graph or Twitter card metadata on any page

No `meta[property^="og:"]` and no `meta[name^="twitter:"]` anywhere, including the pages whose
whole job is to be shared: `/venue/:venueSlug/:eventSlug` and `/tickets/:accessToken`. Pasting an
event link into a text or a group chat produces a bare URL with no title, description or image.

Fix: emit `og:title`, `og:description`, `og:image`, `og:url` and `twitter:card` with `useSeoMeta`,
using the event's own name and artwork on event pages.

### 10. No Content-Security-Policy

The site sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and HSTS, but no
CSP. For a flow that hands off to Stripe and holds a Clerk session, a CSP is the control that
stops an injected tag from exfiltrating session material.

Fix: start with `Content-Security-Policy-Report-Only` allowing `'self'` plus the Clerk and Stripe
origins the app already talks to, then enforce.

### 11. `/scan` hides a failed request instead of reporting it

Covered under finding 3 (kept separate because the harness reports it separately): `useFetch('/api/seller/events', { server: false })` has its `error`
ignored, so a 401 and "this venue has no events yet" look identical to the user.

### 12. Two different sign-in redirect formats are in use

The server emits `Location: /sign-in?redirect=/dashboard` (unencoded) while the client middleware
emits `?redirect=${encodeURIComponent(to.fullPath)}`. Harmless today, but it confirms two separate
implementations of the same rule — which is how `/scan` ended up unguarded in the first place.

---

## Low

| # | Finding | Detail | Fix |
| --- | --- | --- | --- |
| 13 | No `sitemap.xml` | `/sitemap.xml` → 404 | Generate one from published events |
| 14 | `robots.txt` has no `Sitemap:` line | Otherwise correct: disallows `/dashboard`, `/scan`, `/tickets`, `/api` | Add the directive |
| 15 | No `Permissions-Policy` | The scanner requests camera access | `camera=(self), geolocation=(), microphone=()` |
| 16 | HSTS without `includeSubDomains` | `max-age=31536000` only | Add `includeSubDomains; preload` |
| 17 | Obsolete `X-XSS-Protection: 1; mode=block` | Ignored by every current browser | Drop it; a CSP replaces it |
| 18 | No `cache-control` on `/` or `/sign-in` | `/legal/*` sends `s-maxage=3600`, so the inconsistency is unintentional | Set an explicit policy per HTML route |
| 19 | No meta description on `/` | Legal pages have them | `useSeoMeta` on the page |
| 20 | No canonical URL on public pages | — | Emit `link[rel=canonical]` |
| 21 | `/scan` has no `<main>` landmark | Consequence of `layout: false` | Wrap content in `<main>` |
| 22 | Content outside landmarks on `/scan` | Same cause | Use `<header>` / `<main>` |

---

## Found by reading the bundle, not by the harness

### Unvalidated `?redirect=` becomes the post-sign-in destination

`pages/sign-in/[...slug].vue`, from the deployed chunk:

```js
const target = computed(() => route.query.redirect || '/dashboard');
// <SignIn :fallback-redirect-url="target" :sign-up-fallback-redirect-url="target" sign-up-url="/sign-up" />
```

The query parameter is passed to Clerk untouched, and it does round-trip into the page:
`/sign-in?redirect=https://evil.example.com/pwned` renders with that value in the Nuxt payload.
Clerk's own `allowedRedirectOrigins` should refuse to navigate off-origin, so this is most likely
contained today — but the app is relying on a third party's default to not become an open
redirect on its sign-in page, which is the kind of link that gets used in phishing.

Fix: accept only same-site paths — require a leading `/`, reject `//` and any value that parses
with a scheme or host — and fall back to `/dashboard` otherwise. It is a three-line guard.

---

## Not covered

These need a venue login or a live event, so they are untested rather than working:

- The purchase flow: capacity enforcement, Stripe checkout, the $1.50 per-ticket fee, and whether
  `appUrl` (finding 2) actually breaks the post-payment redirect and the ticket email.
- Ticket delivery: email content, QR payloads, and the `/tickets/:accessToken` page itself.
- The venue dashboard, box office and staff management pages.
- Scanning a real ticket, offline queueing, and conflict resolution on re-sync.
- Whether real `/venue/:venueSlug/:eventSlug` pages are indexable, since only the 404 state was
  reachable.
