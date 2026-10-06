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

**Phone layout (open this on your phone):**  
https://holding-persistent-win-tissue.trycloudflare.com/?phone=1

**Desktop layout:**  
https://holding-persistent-win-tissue.trycloudflare.com

> Tunnel URLs expire when the Cloud Agent environment restarts. Ask me to republish if it dies. For a permanent URL, enable GitHub Pages on the `gh-pages` branch.

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
