# site-audit

A black-box bug audit for the deployed TheNetTicket site (`ticket.thenetvr.com`).

It drives a real Chromium against the live deployment and reports defects with the evidence that
proves each one. Nothing here needs credentials, a local checkout of the app, or a staging
database — it only looks at what the site already serves to the public.

Current results: [FINDINGS.md](./FINDINGS.md).

## Run it

```bash
cd site-audit
npm install
npx playwright install chromium
npm run audit
```

Options:

```bash
node audit.mjs --base https://staging.example.com   # audit a different deployment
node audit.mjs --out ./out-nightly                  # write the report somewhere else
node audit.mjs --quiet                              # files only, no console summary
```

The process exits `1` when any high-severity check fails, so it works as a deployment gate.

Output lands in `out/`:

- `report.md` — findings grouped by severity, plus a table of every route checked
- `report.json` — the same data, for diffing between runs
- `screenshots/` — mobile screenshots per route, and the before/after pair from the offline test

## What it checks

HTTP level, no browser:

- `http://` is redirected to `https://`
- `robots.txt` exists and points at a sitemap; `sitemap.xml` is served
- Security headers: CSP and `Permissions-Policy` present, HSTS covers subdomains, no obsolete
  `X-XSS-Protection`, HTML responses set an explicit `cache-control`
- The health endpoint reports healthy

Per route, in Chromium:

- Final status and URL after redirects
- Uncaught exceptions, console errors, failed requests, and any subresource returning >= 400
- `lang`, title, meta description, canonical, Open Graph and Twitter tags, manifest link
- A full axe-core pass, with contrast ratios and failing selectors quoted in the evidence
- Horizontal overflow at 390px wide

Behavioural rules, which is where the interesting bugs live:

- **Auth**: a route marked `protected` must send a signed-out visitor to the sign-in page. If it
  renders instead, and its own API calls came back 401 or 403, the page is reported as an
  unguarded dead end — and separately, if nothing on screen explains the failure, as a swallowed
  error.
- **Runtime config**: the `appUrl` the server serialises into the page must be same-origin with
  the site being audited. This catches a production deployment still advertising
  `http://localhost:3000`.
- **Offline**: for a route marked `mustWorkOffline`, the worker is given time to take control, the
  network is cut, and the page is reloaded. It must still render.
- **Service worker**: the `NavigationRoute` fallback is resolved against the precache manifest.
  A fallback bound to a URL that was never precached is reported even if the worker installs
  cleanly, because in a production Workbox build that failure is silent until someone loses signal.
- **Error pages**: a buyer-facing 404 that leaks the framework name in its title is reported as an
  unbranded error state.

## Adding a route

Edit `audit.config.json`:

```json
{ "path": "/scan", "role": "protected", "pwa": true, "mustWorkOffline": true }
```

`role` is one of `marketing`, `content`, `auth`, `buyer` or `protected`. Discoverability checks
(description, canonical, Open Graph) only apply to `marketing`, `content` and `buyer`, since those
are the pages a stranger can reach and share. Add `"expectNotFound": true` for a probe URL that is
supposed to 404, such as an unknown event slug.

## Layout

| File | Purpose |
| --- | --- |
| `audit.mjs` | CLI entry point: runs the checks, writes the report, sets the exit code |
| `audit.config.json` | Target URL and the route table |
| `lib/http-checks.mjs` | Header, redirect, robots and sitemap checks |
| `lib/page-checks.mjs` | Per-route browser checks, including auth, SEO and axe |
| `lib/offline-checks.mjs` | Service worker analysis and the offline reload test |
| `lib/report.mjs` | Markdown and console output |
| `lib/findings.mjs` | Finding list, deduplicated by check id |
