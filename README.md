# Newport Specialty Partners — MGA CRM & Interactive Portfolio Database

Centralized CRM + portfolio synergy platform for Newport Specialty Partners (Lovell Minnick), combining:

- **Interactive Database** (unified live tables + joins)
- M&A Pipeline dashboard
- Aggregated Portfolio (“One Platform”)
- Retail Agencies (“The Jakes”)
- Synergy engine
- Roll-up simulator
- Schema / ERD viewer aligned to Mary’s transcript requirements

## Live link

**Public demo (Cloudflare Tunnel):**  
https://nurse-desktop-statewide-deliver.trycloudflare.com

> This tunnel stays live while the Cloud Agent environment is running. Re-run `npm run build && npx serve -s dist -l 4173` + cloudflared if it expires.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test
npm run build
```

## Unified Interactive Database

The default workspace is a single interactive database that joins:

| Table | Purpose |
|-------|---------|
| `managing_general_agents` | Core MGA accounts (20–30+ yrs, Pipeline/Acquired) |
| `mga_financials` | Historical EBITDA time-series + YoY growth |
| `insurance_programs` | LOB / Coverage / Region / Carrier tags |
| `retail_agencies` | “The Jakes” — FK → MGA |
| `portfolio_synergies` | Cross-platform value creation |

Search, filter by Pipeline/Acquired, sort Best-in-Class metrics, and drill into related child rows from one screen.
