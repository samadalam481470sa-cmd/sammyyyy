# Fillglen

Fillglen is a job-application platform with a **live question window** that sits beside the form, a Chrome extension that fills from your profile, a dashboard for tracking, and a small API for accounts and AI drafts.

It never invents facts. It never runs on LinkedIn Easy Apply. It never scrapes LinkedIn or Indeed. Final Submit is only clicked in **Autofill & keep applying** after you turn that on. CAPTCHAs wait for you — they are never solved automatically.

## Name

**Fillglen** is a coined mark (fill + glen). A knock-out search of the USPTO register via Trademarkia on 8 October 2026 returned **0** hits for `FILLGLEN`. Close marks that were rejected as names: Formnook (furniture), Fieldstead (existing company), Quayform (QUAY is Red Hat software), Steadform (consultancy), Tallyside (other SaaS), Askridge (NZ holding company). This is not legal clearance.

## Layout

- `packages/core` — types, classify/resolve pipeline, adapters, match score, tailor, AI gates
- `apps/extension` — TypeScript + React + Vite + `@crxjs/vite-plugin` (side panel, pop-out, popup, content scripts)
- `apps/api` — Express + Zod + Helmet + rate limit + audit log (PostgreSQL schema in `src/schema.sql`; local JSON store when `DATABASE_URL` is unset). The **24/7 local finder** lives here: hourly fetch of public Greenhouse/Lever/Ashby/SmartRecruiters/Workable feeds, USAJOBS and Adzuna when keys exist, rule filters, optional Claude/OpenAI scoring, alerts. Chrome does not search.
- `apps/dashboard` — React 19, Vite, Tailwind, Recharts. **Local jobs** map/list and **Saved searches**.

## Download and deploy

**Chrome extension (Load unpacked)** — use this raw zip link (saving the GitHub file *page* gives HTML, not a zip):

**https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/keep-applying-autofill-0208/fillglen-assistant.zip**

Unzip it. You get one folder named `fillglen-assistant/` with `manifest.json` inside. Then `chrome://extensions` → Developer mode on → **Load unpacked** → select that folder.

**Whole platform (API + dashboard + 24/7 finder)** — source zip:

**https://github.com/samadalam481470sa-cmd/sammyyyy/archive/refs/heads/cursor/keep-applying-autofill-0208.zip**

Or clone the branch:

```bash
git clone -b cursor/keep-applying-autofill-0208 https://github.com/samadalam481470sa-cmd/sammyyyy.git
cd sammyyyy/fillglen
npm install
npm test
npm run dev:api        # http://127.0.0.1:8787  (hourly finder on by default)
npm run dev:dashboard  # http://127.0.0.1:5173  → /local, /searches, /live
```

Leave the API running to keep the 24/7 search going. Optional: `FILLGLEN_AI_PROVIDER=claude` or `openai`, plus `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. There is no Chrome Web Store listing yet.

**Autofill & keep applying:** paste a resume in the popup, then hit **Autofill & keep applying**. You do not need the 24/7 API — the extension pulls the built-in researched employer feeds into a queue. While Chrome stays open it fills fields, opens dropdowns, clicks Apply/Next to enter the form, Submit when required fields are filled, then the next job. If a CAPTCHA **challenge** appears, Fillglen **waits on that tab**. Solve it yourself; it then continues. Hidden recaptcha checkboxes do not freeze the loop. It never solves CAPTCHAs. Stop, close Chrome, or sleep to halt. LinkedIn stays blocked.

Branch on GitHub: https://github.com/samadalam481470sa-cmd/sammyyyy/tree/cursor/keep-applying-autofill-0208

## Run

```bash
cd fillglen
npm install
npm test
npm run dev:api      # :8787
npm run dev:dashboard  # :5173  → open /live for the question window
npm run build:extension  # load apps/extension/dist in chrome://extensions
npm run finder           # one server-side fetch cycle (or leave the API running; it schedules hourly)
```

Set `FILLGLEN_AI_PROVIDER=claude` or `openai` on the server to score with a model. The AI never creates listings — every row needs a source URL and first/last seen dates. LinkedIn, Indeed, and Glassdoor are blocked.

## Part 16: Local niche job finder (runs 24/7)

This feature finds jobs that match the user's city, field, and niche, and it keeps searching around the clock. It sends alerts when a strong match appears.

### Where the 24/7 part runs

The always-on work runs on the Fillglen API (`apps/api`), not in Chrome. Manifest V3 shuts down idle extension workers, and search stops when the computer is off. `FINDER_SCHEDULE` (default on) starts an hourly cycle (feeds plus Texas map discovery); `npm run finder` runs one cycle; a cloud scheduler can hit the same worker. While **Autofill & keep applying** is on, the extension also walks Texas map tiles in the background and checks public career pages. `FILLGLEN_AI_PROVIDER=claude|openai|none` is one provider layer so you can switch models with a setting. The dashboard and popup only show results and alerts.

Map discovery uses **OpenStreetMap Overpass** (open map data) and, when `GOOGLE_PLACES_API_KEY` is set, the **official Google Places API**. Fillglen does not scrape the Google Maps website. That would violate Google’s terms and still would not be every company in Texas.

### The rule that keeps it accurate

The AI never creates job listings. It only reads, sorts, and scores real listings pulled from real sources. Every row must have a link to the original posting, the source it came from, and `firstSeenAt` / `lastCheckedAt`. `assertRealListing` rejects invented rows. LinkedIn, Indeed, and Glassdoor URLs are blocked.

Autofill is not limited to Workday. The extension fills the major US applicant systems (Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, Workday, Taleo, SuccessFactors, Oracle Cloud, Jobvite, BambooHR, Workable, ADP, UKG, Paycom, Paylocity, Dayforce, Brassring, Phenom, Eightfold, Avature, Rippling, JazzHR, and others) plus generic `/apply` forms. LinkedIn Easy Apply stays blocked.

### User settings

Saved on **Saved searches** (`/searches`) and applied on every server run: home city and radius, remote/hybrid welcome, target titles, niche keywords and industries, experience level, salary floor, visa sponsorship, excluded companies, alert timing (instant / daily / weekly), and score threshold.

### Where the listings come from

Only official APIs or public feeds (check each source's terms before connecting):

1. Company job boards on Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Recruitee (largest accurate source). The seed prefers Texas IT hiring, then other United States roles. It is not every company in Texas — Workday/Taleo career sites without a public JSON feed stay unmapped on purpose.
2. USAJOBS when `USAJOBS_API_KEY` and `USAJOBS_EMAIL` are set (Dallas, Austin, Houston, San Antonio, and US-wide).
3. Licensed aggregators such as Adzuna when `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` are set (Texas IT and US).
4. Company career pages only when there is no feed — detect the ATS from the pasted careers URL. Respect robots and terms.

Do not scrape LinkedIn, Indeed, or Glassdoor.

### Finding local and niche employers

Big job sites miss small and niche companies. `packages/core/data/dfw-employers.json` is a Texas seed (chamber / journal / career-fair style sources). `packages/core/data/us-it-employers.json` adds US IT companies with public feeds. Mapped slugs are pulled every run; Dell, AT&T, American Airlines, Texas Instruments, USAA, and other Workday/custom boards stay unmapped on purpose so coverage is honest. Users can paste a careers link; the server maps Greenhouse/Lever/Ashby/SmartRecruiters/Workable automatically. Coverage is `mappedCount / seedCount` — no system finds every job.

### Pipeline on every run

1. **Fetch** public feeds (hourly on the server; follow rate limits).
2. **Clean** into one format: title, company, location, remote status, salary, description, link, dates.
3. **Fix locations** with DFW/Austin aliases so "DFW", "Dallas-Fort Worth Metroplex", "Richardson, TX", and "Plano" are distance-searchable. Mark on-site / hybrid / remote.
4. **Remove duplicates** on company + title + location; keep every source link.
5. **Filter with rules first** (radius, seniority, excluded companies, sponsorship). Rules are free; the AI only sees jobs that pass.
6. **Score** — expand titles (e.g. "IT systems" → Systems Analyst, Implementation Specialist, IT Business Analyst), infer true experience level, score niche fit 0–100, write one why sentence, flag scams / missing company / months-old reposts. With a provider set, Claude or OpenAI can refine that score (`FILLGLEN_AI_BATCH=1` uses the cheaper batch path when you wire a batch job).
7. **Verify** the posting link still works before an alert.
8. **Alert** matches above the threshold (dashboard badge, popup count, `/v1/finder/alerts/dispatch`).
9. **Re-check** open jobs; mark them closed instead of deleting so the tracker keeps history.

### Controlling AI cost

Rule filters run before any model call. Scores are cached per listing + similar settings (`scoreCache`). Daily caps: `FILLGLEN_AI_DAILY_LIMIT` (system) and `FILLGLEN_AI_USER_DAILY` (per user).

### Learning from the user

Thumbs up / thumbs down and "Not interested because…" (too senior, wrong location, wrong industry) feed `applyFeedback` on later scores. Sample alerts by hand each week and tune the threshold; coverage on Local jobs stays honest about unmapped employers.

### Optional MCP connector

`GET /v1/mcp/tools` and `POST /v1/mcp/search_local_jobs` expose the already-fetched database. A connector only answers when asked (e.g. "show me new cybersecurity jobs within 20 miles of Carrollton"). 24/7 searching still happens on the server.

### Screens

- **Local jobs** (`/local`) — DFW map + list, filters, scores, one-line reasons, thumbs.
- **Saved searches** (`/searches`) — settings, alert timing, paste-a-careers-URL mapper.
- **Extension popup** — new match count and the top three jobs.
- **Live question window** — when the posting came from this feed, the header already shows its match score.

### Build order

This ships after accounts and the API, in this sequence:

1. Company feeds for one city (DFW) with rule filters only.
2. Location fixing and duplicate removal.
3. AI scoring and alerts.
4. Employer discovery and coverage tracking.
5. More cities, government sources, and aggregators (Austin seed + USAJOBS/Adzuna keys).
6. The optional MCP connector.

## Ground rules in code

- Final Submit is detected and never auto-clicked (`submitGuard`).
- LinkedIn hosts are blocked (`linkedin.ts`).
- Self-identification defaults to Decline and is refused by the AI module.
- Matching rules ship as JSON data (`packages/core/data/matching-rules.json`) so they can be updated without shipping remote code.
