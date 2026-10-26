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

Sign-in is Microsoft Entra ID only (`https://login.microsoftonline.com/common`). Work accounts from any firm, Outlook.com, Hotmail, Live, and MSN enter their username and password on Microsoft’s page. Newport does not store that password, and the sign-in field starts blank.

The dashboard opens only after Microsoft accepts the account. Sign out ends that session only — CRM edits stay in this browser and come back with the same email.
Sessions are device-signed with a random token; another email cannot open your vault. Failed sign-ins are throttled.

## 24/7 static demo (GitHub Pages)

Build and publish the `gh-pages` branch, then enable Pages:

**Settings → Pages → Deploy from a branch → `gh-pages` / (root)**

Demo URL: https://samadalam481470sa-cmd.github.io/sammyyyy/

On static hosting, edits persist in the browser (`localStorage`) so reopening the link keeps your changes.

## Modules

Dashboard, Opportunities, Projects, Relationships, Tasks, Sources/Bankers, Carriers/Reinsurers, Portfolio, Documents, Reports, Security.

## Projects in this repo

- **Newport Acquisition CRM** (repo root) — Enterprise M&A / acquisition deal-management app for Newport Specialty Partners.
- **homegrok/** — Local AI assistant and job-application helper that runs on your machine (Python).
- **market-agent-connector/** — Python AI agent connector for Kalshi and Polymarket prediction markets and stock trading via MCP and REST.

## HomeGrok

HomeGrok fully runs an AI trainer on your own GPU — you can teach it anything.

<small><em>(Uses Apple Metal or NVIDIA CUDA when available; falls back to CPU otherwise.)</em></small>

The trainer (`./hg learn`, `train`, `evolve`, and `pipeline` in `homegrok/`) uses a GPU when Apple Metal or CUDA is available, and otherwise trains on the CPU.
