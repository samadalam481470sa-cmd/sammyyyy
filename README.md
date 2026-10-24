# Newport Specialty Partners — Acquisition CRM

Enterprise M&A / acquisition deal-management app for Newport Specialty Partners.

> This repository also contains other packages under `job-finder/` and `chrome-extension/` from prior work. The **root** of the repo is the Newport Acquisition CRM.

## Permanent database (GitHub)

GitHub holds the reconstructable CRM database and every application source file:

- Schema: `server/db/schema.sql`
- Canonical demo rows: `server/db/seed.sql` (dataset `anon-letter-v1`)
- TypeScript seed used by the static demo: `src/data/mockOpportunities.ts`, `mockModules.ts`, `mockMeetings.ts`
- App and API: `src/` and `server/`

Rebuild a local SQLite file with `npm run db:rebuild`. Refresh `seed.sql` after mock or schema edits with `npm run db:dump`. Runtime `data/*.db` files stay gitignored (WAL, sessions, live edits). Do not commit user vaults.

GitHub Pages cannot run SQLite. The hosted demo stores each signed-in email's edits in that browser. Sign-out ends the session only; the same email restores that vault.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS
- Express API + SQLite (`better-sqlite3`) database
- Lucide icons, Recharts, Zod validation
- Helmet, rate limiting, Microsoft 365 (MSAL) sign-in, audit logging + change history

## Run locally

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

## Sign in

The home screen offers four ways in: **Microsoft 365** (large, on top), then **Outlook**, **Gmail**, and **other email**.
Continue with Microsoft 365 opens Microsoft when `VITE_MSAL_CLIENT_ID` is set (popup first, redirect only if the popup is blocked). Without that client ID, a valid Microsoft / work / personal email is checked immediately and opens the dashboard.
Sign out ends that session only — CRM edits stay in this browser and come back with the same email.
Sessions are device-signed with a random token; another email cannot open your vault. Failed sign-ins are throttled.

## 24/7 static demo (GitHub Pages)

Build and publish the `gh-pages` branch, then enable Pages:

**Settings → Pages → Deploy from a branch → `gh-pages` / (root)**

Demo URL: https://samadalam481470sa-cmd.github.io/sammyyyy/

On static hosting, edits persist in the browser (`localStorage`) so reopening the link keeps your changes.

## Modules

Dashboard, Opportunities, Projects, Relationships, Tasks, Sources/Bankers, Carriers/Reinsurers, Portfolio, Documents, Reports, Security.
