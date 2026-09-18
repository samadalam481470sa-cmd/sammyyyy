# Newport insurance CRM — MVP schema

## Relationship map

```text
Mga
 ├──< FinancialPeriod       fiscal-year EBITDA / revenue / premium
 ├──< InsuranceProgram      line of business / coverage / region
 └──< RetailAgency          independent retail distribution

Client
 └──< FollowUp              call / email / meeting / renewal / claim check-in

Workbook
 ├──< PolicyRow             editable insurance spreadsheet rows
 └──< WorkbookMember        email-specific access grants
```

The source of truth is `prisma/schema.prisma`.

## Design decisions

### MGA status is two buckets plus one stage

`Mga.status` is either `PIPELINE` or `ON_PLATFORM`, exactly matching the
requested prospect/acquired distinction. `Mga.stage` adds the corp-dev workflow
without weakening that distinction: sourced, qualified, diligence, under LOI,
closed or passed.

### EBITDA growth is derived, never stored

One `FinancialPeriod` row exists per MGA and fiscal year. YoY growth and CAGR
are calculated in `src/lib/metrics.ts`, so restating an input changes every
dashboard automatically. A projected year is labelled and excluded from
pipeline ranking by default.

The current platform definition follows Mary's wording: earnings before
interest, bad debt and taxes. `badDebtAddbackUsd` is also kept separately so a
conventional EBITDA can be shown later without re-entering source data.

### Program tags are canonical strings

Line of business, coverage type and region are strings constrained by the
canonical lists in `src/lib/taxonomy.ts`. Exact shared tags drive overlap and
cross-sell analysis. A production system may promote these into lookup tables
without changing the analysis model.

### Retail agencies are one-to-many in the MVP

Each `RetailAgency` has one `mgaId`, matching the requested `Associated_MGA`
foreign key. If the same retailer can be appointed through several platform
MGAs, this must become a many-to-many `RetailAgencyAppointment` table.

### Workbooks support two access models

- `ORGANIZATION`: every authenticated Newport organization account can view it.
  Explicit member grants can elevate a person to editor. The primary register
  is permanently organization-wide.
- `RESTRICTED`: only the owner or a `WorkbookMember` email grant can view it.
  Members are indexed by email and paged/searched in the interface, so hundreds
  of users do not become hundreds of avatars.

The local MVP simulates the owner. Production needs Microsoft Entra ID / Outlook
SSO and server-side permission checks for every mutation and export.

### Spreadsheet and clients are intentionally separate

`PolicyRow` is the operational book of business. `Client` is the relationship
record with contact, producer, premium and next action. They are not linked in
this MVP because historical spreadsheets often contain several spellings of one
insured. A production import should establish a stable `clientId` after
deduplication rather than create false matches from names.

### Follow-ups use standard Outlook calendar files

A follow-up downloads as an RFC 5545 `.ics` file with a 30-minute event and
15-minute reminder. Outlook opens it directly without giving the MVP mailbox
permissions. Direct Microsoft Graph sync is a later integration requiring Entra
app registration and delegated calendar scopes.

## Production hardening

1. Move SQLite to managed Postgres.
2. Add Entra ID SSO and organization membership validation.
3. Enforce `getWorkbookPermission()` inside every workbook server action.
4. Add audit events for all row edits, exports and access changes.
5. Encrypt sensitive client fields and define retention rules.
6. Put backups in encrypted object storage and test restore, not only export.
7. Add background jobs for renewal reminders and direct Microsoft Graph sync.
