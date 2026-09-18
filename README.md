# Newport Specialty Partners — MGA Platform

A CRM and portfolio management platform for an insurance private-equity roll-up strategy (backed by Lovell Minnick). It tracks Managing General Agents (MGAs) through the acquisition pipeline and, once acquired, surfaces cross-portfolio synergies on a single aggregated dashboard.

## Quick start

```bash
npm install
npm run seed     # creates data/newport.db and loads demo data
npm start        # serves the app at http://localhost:3000
```

Run the automated API and metrics tests:

```bash
npm test
```

## What it does

- **M&A Pipeline dashboard** — every prospective MGA, ranked by best-in-class metrics: EBITDA CAGR, year-over-year EBITDA growth, latest EBITDA, and years of experience. Filter by geographic region, line of business, and a one-click "20+ yrs experience" toggle. A "Mark acquired" action moves a target onto the platform.
- **One Platform dashboard** — all acquired MGAs with aggregate KPIs (platform EBITDA, MGA count, retail agencies managed) and a Synergy Map: any line of business, coverage type, or geographic region shared by two or more platform MGAs is highlighted in gold, both in the side panel and on the matching chips of each MGA card.
- **MGA detail drawer** — historical EBITDA bar chart and year-over-year growth table, the MGA's insurance programs (line of business / coverage type / region), and the retail agencies ("the Jakes") it manages.
- **Pipeline intake** — add a new target MGA from the UI or via the API.

## Data model

| Table | Purpose | Key fields |
| --- | --- | --- |
| `mgas` | Core account entity | `name`, `status` (`pipeline` \| `acquired`), `years_of_experience`, `headquarters`, `acquired_date` |
| `mga_financials` | Historical EBITDA time-series | `mga_id` (FK), `fiscal_year`, `ebitda` — unique per MGA + year |
| `insurance_programs` | One MGA has many programs | `mga_id` (FK), `line_of_business`, `coverage_type`, `geographic_region` |
| `retail_agencies` | "The Jakes" managed by each MGA | `mga_id` (FK), `name`, `principal`, `state`, `annual_premium` |

EBITDA growth (CAGR across the full series and latest year-over-year) is computed server-side from the time-series, so the pipeline can always be sorted by growth without denormalizing.

## API

| Method & path | Description |
| --- | --- |
| `GET /api/mgas` | List MGAs with computed metrics. Query params: `status`, `region`, `lob`, `min_years`, `sort` (`cagr`, `yoy`, `ebitda`, `years`, `name`) |
| `GET /api/mgas/:id` | Full detail: financials, programs, retail agencies, metrics |
| `POST /api/mgas` | Create a pipeline MGA (`name`, `years_of_experience` required) |
| `PATCH /api/mgas/:id/status` | Move between `pipeline` and `acquired` (stamps `acquired_date`) |
| `GET /api/synergies` | Portfolio KPIs plus overlap analysis of lines, coverages, and regions across acquired MGAs |
| `GET /api/meta` | Distinct regions / lines of business / coverage types for filters |

## Stack

Node.js + Express 5, SQLite (`better-sqlite3`), and a dependency-free vanilla JS/CSS frontend — no build step, so iteration between demos stays fast.
