# Newport Specialty Partners — Insurance CRM

A responsive CRM and portfolio platform for an insurance private-equity roll-up.
It manages MGA acquisition targets, acquired companies, historical EBITDA,
insurance programs, retail agencies, insured clients, follow-up tasks, and a
shared policy spreadsheet.

## What is included

- Executive overview with aggregate platform EBITDA
- M&A pipeline with transparent Best in Class screening
- Aggregated portfolio capability matrix
- Synergy analysis across line of business, coverage type and region
- MGA detail pages with EBITDA history, programs and retail agencies
- Insurance client CRM with due/overdue follow-ups
- Outlook-compatible `.ics` calendar downloads for follow-ups
- Company-wide insurance spreadsheet plus email-restricted workbooks
- Searchable member management designed for hundreds of people
- CSV export and a complete point-in-time JSON CRM backup
- Read-only JSON APIs for MGA, portfolio, agency and synergy data

## Run it

Requires Node.js 20+.

```bash
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run setup` copies `.env.example` to `.env`, generates the Prisma client,
creates the SQLite database and loads the illustrative dataset.

## Verify it

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Data and security

All companies, people, policies and financial values in the seed are fabricated
for product review.

The MVP uses a simulated owner (`mary@newportsp.com`) to make the full sharing
workflow testable locally. The access model is implemented and tested, but a
production deployment must connect it to Newport's SSO (Microsoft Entra ID),
enforce permissions in every server action, and put `/api/backup` behind an
owner/admin check. See `docs/SCHEMA.md` and `docs/CALL-NOTES.md`.
