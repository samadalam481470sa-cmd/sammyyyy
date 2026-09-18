# Newport Specialty Partners — MGA CRM & Portfolio Platform (MVP Wireframe)

A centralized CRM and portfolio management platform for tracking, acquiring, and managing
Managing General Agents (MGAs), built for Newport Specialty Partners (backed by Lovell Minnick).

This is the **minimum viable schema + wireframe** to review on the 7:00 PM call: does it capture
the metrics that matter (EBITDA, Line of Business, Region, Years of Experience) exactly as they
should look on screen?

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io/) ORM with SQLite for the MVP (swap to Postgres for production —
  see `prisma/schema.prisma`)
- [Recharts](https://recharts.org/) for the historical EBITDA chart

## Core entities

| Entity | Purpose |
| --- | --- |
| `Mga` | The primary CRM record — an MGA target/portfolio company. Tracks `yearsOfExperience`, `status` (`PIPELINE` vs `ACQUIRED`), and pipeline stage. |
| `EbitdaRecord` | Time-series historical EBITDA (and revenue) per year, per MGA — used to compute YoY growth and CAGR. |
| `InsuranceProgram` | A program run by an MGA, tagged with `lineOfBusiness`, `coverageType`, and `geographicRegion`. A single MGA can have many. |
| `RetailAgency` | "The Jakes" — independent retail agencies distributing an MGA's programs, linked via `mgaId`. |

See `prisma/schema.prisma` for the full schema and `prisma/seed.ts` for realistic demo data.

## Dashboards

- **Overview (`/`)** — snapshot of pipeline size, on-platform EBITDA, top synergies, and the
  fastest-growing pipeline targets.
- **M&A Pipeline Dashboard (`/pipeline`)** — sortable/filterable table of prospective MGAs, with
  "Best in Class" quick filters for 20+ years of experience and 20%+ EBITDA growth, plus a region
  filter and free-text search.
- **Aggregated Portfolio View (`/portfolio`)** — the "One Platform" master view of acquired MGAs,
  including a synergy matrix and overlap panels that highlight shared lines of business, coverage
  types, and regions across the portfolio.
- **MGA Detail (`/mga/[id]`)** — historical EBITDA chart + table, insurance programs, and retail
  agencies for a single MGA.

## Getting started

```bash
npm install
npm run db:push    # create the SQLite schema (prisma/dev.db)
npm run db:seed     # populate demo MGAs, financials, programs, and agencies
npm run dev          # start the dev server on http://localhost:3000
```

Other useful scripts:

```bash
npm run build   # production build + type-check
npm run lint    # ESLint
npm run db:reset  # wipe + re-push + re-seed the database
```

## Notes on the data model

- SQLite has no native enum support, so `Mga.status` and `Mga.pipelineStage` are modeled as
  `String` columns constrained to the literal unions defined in `src/types/mga.ts`. Moving to
  Postgres later can promote these back to first-class Prisma enums.
- Derived metrics (latest EBITDA, YoY growth, CAGR, and rolled-up region/LOB/coverage lists) are
  computed on read in `src/lib/metrics.ts` rather than stored, so they always reflect the latest
  financial and program data.
- Synergy detection (`src/lib/synergies.ts`) groups acquired MGAs by shared line of business,
  coverage type, or region and surfaces any attribute shared by 2+ portfolio companies.
