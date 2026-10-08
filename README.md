# Newport Specialty Partners — Acquisition CRM

Enterprise M&A / acquisition deal-management app for Newport Specialty Partners.

> This repository also contains other packages under `job-finder/` and `chrome-extension/` from prior work. The **root** of the repo is the Newport Acquisition CRM.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS
- Express API + SQLite (`better-sqlite3`) database
- Lucide icons, Recharts, Zod validation
- Helmet, rate limiting, hashed sessions & API keys, audit logging + permanent change history

## Run locally

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

## Sign in

1. **Sign in — Demo access** enters the dashboard (Dennis session).
2. Or authenticate with the local demo API key (slot 1 only):
   `nwp_demo_key_slot1_replace_me_by_security_team`

Production will use **five API key slots** provisioned by the security team. This app stores **hashes only**.

## 24/7 static demo (GitHub Pages)

Build and publish the `gh-pages` branch, then enable Pages:

**Settings → Pages → Deploy from a branch → `gh-pages` / (root)**

Demo URL: https://samadalam481470sa-cmd.github.io/sammyyyy/

On static hosting, edits persist in the browser (`localStorage`) so reopening the link keeps your changes.

## Modules

Dashboard, Opportunities, Projects, Relationships, Tasks, Sources/Bankers, Carriers/Reinsurers, Portfolio, Documents, Reports, Security.
