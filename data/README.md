# Runtime SQLite

`newport-crm.db` is created on this machine when the API starts, or with `npm run db:rebuild`.
It is gitignored on purpose: WAL files, sessions, and live edits must not land on GitHub.

The **permanent database** lives in the repository:

- `server/db/schema.sql` — tables, indexes, constraints
- `server/db/seed.sql` — anonymized demo rows (`anon-letter-v1`)
- `src/data/mockOpportunities.ts`, `mockModules.ts`, `mockMeetings.ts` — TypeScript seed used by the static GitHub Pages demo

Rebuild a local file:

```bash
npm run db:rebuild
```

Refresh `seed.sql` after mock or schema changes:

```bash
npm run db:dump
```
