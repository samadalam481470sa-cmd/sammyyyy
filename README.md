# Newport Specialty Partners — MGA CRM (MVP)

Responsive web CRM for Newport Specialty Partners (backed by Lovell Minnick) to track, acquire, and manage MGAs — and surface portfolio synergies.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What's in this MVP

| View | Route | Purpose |
|------|-------|---------|
| Home | `/` | Brand entry + counts |
| M&A Pipeline | `/pipeline` | Prospect MGAs with Best-in-Class filters (experience, region, YoY EBITDA growth) |
| One Platform | `/portfolio` | Acquired MGAs + synergy overlaps (LoB / coverage / region) |
| Schema wireframe | `/schema` | Entity model for Mary / leadership confirmation |
| MGA detail | `/mgas/[id]` | Financials, programs, retail agencies ("The Jakes") |

## Schema (confirm with Mary)

- **MGA** — `Years_of_Experience`, `Status` (pipeline \| acquired)
- **MGA Financials** — historical `EBITDA` time-series → YoY growth
- **Insurance Programs** — `Line_of_Business`, `Coverage_Type`, `Geographic_Region`
- **Retail Agencies** — `Associated_MGA` FK

Seed data lives in `src/lib/data.ts`. Types in `src/lib/schema.ts`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · in-memory seed data (no DB yet)
