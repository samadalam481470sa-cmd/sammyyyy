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

**Public demo (Cloudflare Tunnel — currently live):**  
https://parent-layout-locate-lafayette.trycloudflare.com

> If that URL times out later, the temporary tunnel expired (Cloud Agent restart). Ask me to republish and I’ll spin up a fresh link in ~30 seconds. For a permanent URL, enable GitHub Pages on the `gh-pages` branch (already pushed) under repo Settings → Pages.

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
