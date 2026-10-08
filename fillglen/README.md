# Fillglen

Fillglen is a job-application platform with a **live question window** that sits beside the form, a Chrome extension that fills from your profile, a dashboard for tracking, and a small API for accounts and AI drafts.

It never clicks the final Submit button. It never invents facts. It never runs on LinkedIn Easy Apply. It never scrapes LinkedIn or Indeed.

## Name

**Fillglen** is a coined mark (fill + glen). A knock-out search of the USPTO register via Trademarkia on 8 October 2026 returned **0** hits for `FILLGLEN`. Close marks that were rejected as names: Formnook (furniture), Fieldstead (existing company), Quayform (QUAY is Red Hat software), Steadform (consultancy), Tallyside (other SaaS), Askridge (NZ holding company). This is not legal clearance.

## Layout

- `packages/core` — types, classify/resolve pipeline, adapters, match score, tailor, AI gates
- `apps/extension` — TypeScript + React + Vite + `@crxjs/vite-plugin` (side panel, pop-out, popup, content scripts)
- `apps/api` — Express + Zod + Helmet + rate limit + audit log (PostgreSQL schema in `src/schema.sql`; local JSON store when `DATABASE_URL` is unset)
- `apps/dashboard` — React 19, Vite, Tailwind, Recharts

## Run

```bash
cd fillglen
npm install
npm test
npm run dev:api      # :8787
npm run dev:dashboard  # :5173  → open /live for the question window
npm run build:extension  # load apps/extension/dist in chrome://extensions
```

## Ground rules in code

- Final Submit is detected and never auto-clicked (`submitGuard`).
- LinkedIn hosts are blocked (`linkedin.ts`).
- Self-identification defaults to Decline and is refused by the AI module.
- Matching rules ship as JSON data (`packages/core/data/matching-rules.json`) so they can be updated without shipping remote code.
