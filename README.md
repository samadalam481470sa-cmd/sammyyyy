# Newport Specialty Partners CRM

Responsive MVP for managing MGA acquisition targets and visualizing portfolio
performance and synergies across acquired businesses.

## Included

- Portfolio dashboard with combined EBITDA trend, retail agency reach, and overlap signals
- M&A pipeline with search, region, best-in-class, and sorting controls
- Relational PostgreSQL schema for MGAs, historical financials, insurance programs, and retail agencies
- Responsive navigation and layouts for desktop, tablet, and mobile

## Run locally

```bash
npm install
npm run dev
```

Production validation:

```bash
npm test
npm run build
```

The SQL proposal is in `db/schema.sql`.
