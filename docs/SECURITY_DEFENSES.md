# Newport CRM — attack defenses

Code: `server/middleware/defense.ts`, `server/middleware/security.ts`, `server/app.ts`.
Tests: `server/middleware/defense.test.ts` sends the attacks below to a running copy of the API.

| Attack | Defense |
| --- | --- |
| SQL injection | Every query binds values as parameters. Table and column names come only from fixed lists in the code. Attack text in a record is stored as plain text. Probes in the URL are refused, logged and count toward a block. |
| Brute force on sign-in | 5 failures from an address start a block: 30 minutes, then 2 hours, then 24 hours. Blocks are stored in the database, so a restart does not lift them. The address no longer changes with each connection's port. |
| Token guessing | Unknown session tokens add up to a block, and an address-wide limit (900 per minute) applies whatever token is sent. Tokens are long, random and stored only as hashes. |
| Request floods | Limits per address, session, AI call, save and upload. Body size limits. Slow-connection timeouts. |
| Scanners and path traversal | Requests for files such as `.env` or `wp-login.php`, and `../` paths, are refused and count toward a block. |
| Script injection (XSS) | React escapes all text. Page CSP blocks unexpected scripts. Email HTML shows in a sandboxed frame with scripts off. Script probes in URLs are refused. |
| Cross-site request forgery | Sign-in uses bearer tokens, not cookies. Only the approved website may call the API. |
| Clickjacking | The API refuses framing. The page cannot fully refuse it, as noted below. |
| Prototype pollution, deep JSON | Keys such as `__proto__` and bodies nested past 40 levels are refused. |
| Malicious uploads | Programs and page files are refused by name and first bytes. Downloads are always sent as attachments, not opened as pages. Total storage has a 5 GB limit. |
| Excel formula injection | Text cells that start with `= + - @` are made safe in CSV exports. |
| Stolen or impersonated access | Sign-in tokens are verified against Microsoft's keys. Only approved accounts get in. Each person keeps at most 10 sessions. The Microsoft account link on a Deal Lead cannot be moved by an edit. |
| Information leaks | Errors return plain messages, health returns no internals, and the framework name is hidden. |
| Vulnerable libraries | `npm audit fix` applied. `xlsx` remains, as noted below. |

## Monitoring

Administrators see **Security > Attack defense**: blocked addresses, the last 24 hours, the latest events, and a Lift block button. The log keeps one entry per type, address and minute for 30 days, so an attack cannot fill the database.

A person with a valid session is never blocked, so an attacker on a shared office network cannot lock out the office. A person not yet signed in on that network can be blocked until an administrator lifts it. `DEFENSE_TRUSTED_IPS` in Azure lists addresses that never collect strikes.

## What this does not cover

- **Large network attacks (DDoS).** App limits cannot absorb them. That needs Azure Front Door or a similar service in front of the API.
- **Stolen Microsoft passwords.** Turn on multi-factor sign-in on every Microsoft account. The CRM does not control it.
- **Malware on a signed-in person's computer.** It can act as that person. Every change is still logged.
- **GitHub Pages headers.** Pages cannot send response headers, so the page has its CSP in a meta tag, where `frame-ancestors` has no effect.
- **`xlsx`.** No npm fix exists for this library. It only reads files a signed-in person chooses, in their own browser, and imports now stop at 10 MB. The full fix is to replace the library.
- **Shared editing.** Any approved user can change any shared record, including Deal Leads, by the sponsor's decision. Finer roles need a separate decision on who may edit what.
- **Public repository.** Anyone can read this code, including these limits. Security must not depend on it staying secret. Secrets belong only in Azure settings.
- **Files and records at rest.** They rely on Azure's disk protection. Backups are not automated by this work.

No system stops every attack. An outside security test before real client data goes in is still worth doing.

## November 5, 2026 changes

Private meetings moved to owner-keyed server tables, and any other person gets 404. The audit trail in `workspace_audit` cannot be changed, because database triggers refuse it. Deal Lead edits are open to every approved user by decision of the sponsor; the Microsoft account link on a lead cannot be moved by an edit, and deleting a lead in use is refused on the server. See `docs/SHARED_BACKEND.md`.
