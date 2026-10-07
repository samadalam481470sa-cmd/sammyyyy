# Newport Specialty Partners — Acquisition CRM

Enterprise M&A / acquisition deal-management app for Newport Specialty Partners.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS
- Express API + SQLite (`better-sqlite3`) database
- Lucide icons, Recharts, Zod validation
- Helmet, rate limiting, hashed sessions & API keys, audit logging

## Run locally

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

## Sign in

1. Open the app → **Sign in (Demo)** enters the dashboard (Dennis session).
2. Or authenticate with the local demo API key (slot 1 only):
   `nwp_demo_key_slot1_replace_me_by_security_team`

Production will use **five API key slots** provisioned by the security team. This app stores **hashes only**.

## What this sprint covers

- Auth gate + API key infrastructure
- SQLite database for opportunities / sessions / api_keys / audit_logs
- Dashboard (acquisition snapshot)
- Opportunities page — edit status, entity, and full deal record
- Projects page — Project 1 / Project 2 / Project 3… with editable right-side tabs (status editable on every tab)
- Security page — key slots + audit trail

## Demo data

Financial figures and company names are fictional.
