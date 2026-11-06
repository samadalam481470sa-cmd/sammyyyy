# Shared Backend: Audit, Decisions and Operations

Sprint of November 5, 2026. The prompt is in `docs/Newport_CRM_Shared_Backend_Sprint_Nov5_2026.txt`.

## What the audit found

| Area | State before this sprint |
| --- | --- |
| Frontend | React on GitHub Pages. `public/api.json` names the server. |
| Server | Express on Azure App Service, with better-sqlite3 at `/home/data/newport-crm.db`. |
| Identity | Microsoft ID token verified on the server (signature, audience, issuer, expiry). `ALLOWED_EMAILS`, `ALLOWED_EMAIL_DOMAINS` and `ALLOWED_TENANT_IDS` decide who gets in. |
| Shared records | `workspace_records`, one row per record. Clients sent the changed records and polled every 10 seconds. |
| Concurrent edits | Silent last write wins. |
| Meetings | Browser only, so a second device saw nothing. Any signed-in user could read leftover `meetings` rows by calling the API directly. |
| Restore | One click could overwrite the shared data with a file. |
| Full pull | Replaced a browser's data with no copy kept. |
| Files | SQLite blobs behind sign-in. SharePoint is not configured. |

Other findings: starter data could be merged in by a new browser and pushed to the server, which could bring back records the team had deleted. The two default Deal Leads were merged back on every load, so they could not stay deleted.

## Storage decision

Structured records stay in the existing SQLite database on the Azure App Service. It is already deployed and backed by durable storage, has no new cost, and supports transactions.

| Option | Assessment |
| --- | --- |
| Azure SQL or PostgreSQL | The better choice if several server instances are ever needed. It adds a monthly cost and a data migration, and needs a subscription decision from Newport. |
| SharePoint Lists | Weak fit for records with relationships and revision checks. Graph API limits also apply. |
| SharePoint library for files | A reasonable future home for documents. It needs tenant consent and a private site, which are not available yet. |

**Limit to know about:** SQLite means one server instance. Do not scale the App Service out past one instance. Moving to Azure SQL is the step to take before that.

Files stay in the server database, behind sign-in and capped at 25 MB per file and 5 GB in total. The browser only talks to the `/api/workspace/files` routes, so a move to SharePoint would change the server only. **SharePoint is not built or connected.**

## Data model

Every change below is additive, and the server applies it at startup.

| Table | Purpose |
| --- | --- |
| `workspace_records` + `rev` | Shared records. Each save raises `rev`. A deleted record stays as a tombstone, so it cannot return. |
| `private_meetings` | Meeting records, keyed by `(owner_subject, id)`. |
| `private_meeting_files` | Transcript files, keyed by `(owner_subject, meeting_id, kind)`. |
| `workspace_audit` | Actor, time, record, action and changed field names. Database triggers refuse any update or delete. |
| `workspace_meta` | One-time migration flags. |

`owner_subject` is the verified Microsoft account id, not the email address.

## Behaviour the server enforces

- **Conflicts.** Each change carries the revision it was based on. If the record has moved on, the server keeps its copy and returns it. The browser merges fields only one person changed, and names any field both changed. The saved value stays.
- **Private meetings.** Every query filters by the verified account. Another person's id returns 404. Old `meetings` rows and old shared transcripts are closed to everyone but not deleted.
- **Deal Leads.** Any approved user can create and edit. The Microsoft account link cannot be moved by an edit. Delete runs a usage check inside one transaction and returns exact counts when the lead is in use. A stale screen cannot assign a deleted lead.
- **Saves.** The editor shows "Saved" only after the server answers. If the server cannot be reached, the change is undone on screen, the draft stays, and the message says it was not saved.

Sync timing: other people's changes arrive within 10 seconds, at once on window focus or reconnect, and at once between tabs of one browser. A hidden tab checks once a minute.

## Local data and imports

- Before a browser with its own earlier data first joins the workspace, it keeps a copy in that browser. It keeps a new copy if edits were made while disconnected. Settings can download or review that copy.
- "Import a Backup" compares a file with live records and shows new, identical, different and possible duplicate counts. It adds new records only, unless a box is ticked. It never deletes. A record the team deleted stays deleted. The last import can be undone.
- A browser's own meetings are uploaded to that person's private store automatically the first time. This is automatic, not opt-in, because it stays private to them and is what lets their other devices see it.
- Sign-out clears cached meetings and calendar from the browser once the server is confirmed to have them.

## Backups and recovery

- **Automatic.** The server copies the whole database once a day to `backups/` beside it (or `CRM_BACKUP_DIR`), and keeps 14 days. Administrators can see the list at `GET /api/security/backups`. The copies hold private meetings, so no route can download them.
- **Company records file.** Settings → Download company records contains shared records only, never meetings.
- **Personal file.** Settings → Download my meetings contains the signed-in person's meetings only.

To recover the database:

1. Stop the App Service.
2. In Kudu or SSH, copy `/home/data/newport-crm.db` to a safe name.
3. Copy the chosen file from `/home/data/backups/` over `/home/data/newport-crm.db`, and remove any `-wal` and `-shm` files beside it.
4. Start the App Service. Browsers pull the restored records on their next sign-in.

Changes made after that copy are lost, so check the audit trail first.

## Deployment

Pushing to `main` deploys both parts: `.github/workflows/deploy-pages.yml` publishes the frontend, and the Azure workflow publishes the server. The tables are added at startup. No new secrets are needed.

Environment template: `.env.example`. New optional value: `CRM_BACKUP_DIR`. Set `ADMIN_EMAILS` to see the Security page and the backups list.

**Rollback.** Revert the commit and push. The new tables and the `rev` column are ignored by older code, so no database change is needed. Older code will show nothing from `private_meetings`, and those meetings return when the new code does.

## Verifying with two real Microsoft accounts

Use two approved accounts in two separate browsers (not two tabs). A is the first and B the second.

1. A changes a stage on a Full Profile. Before Save, B sees no change. After Save, B sees it on Opportunities, Dashboard, Reports and Recent Activity within 10 seconds.
2. B creates a task with an owner, marks it Done, and A sees it in Task History. A restores it and B sees it open.
3. A adds a Deal Lead and links it to a deal. B sets it to Inactive. A no longer sees it as a Task Owner choice. Check Reports counts the deal once.
4. A uploads a document. B downloads it. A deletes it. B cannot open it, and it does not return after a reload.
5. A saves a meeting with a transcript and opens it on a second device. B opens the same deal's Meetings tab and sees nothing. B calls `GET /api/workspace/meetings/<id>` with B's token and gets 404.
6. A and B open one deal. Disconnect B, have A save a stage, reconnect B, have B save a different stage. B gets a notice naming A and the field. A's value stays.
7. Turn off B's network and save. B sees "Not saved" and keeps the draft.
8. Check email, calendar and Gemini summaries still work for each account.

## What was tested, and what was not

Tested on this build against the real server code and a real database file, with two independent browser sessions under different account ids: items 1 to 7 above, plus Settings import, Undo, sign-out clearing, bell links and page fit. The two-session API tests are in `server/routes/workspace.test.ts`.

**Those sessions used test account ids with sessions created directly in the database. They did not sign in through Microsoft.**

Not tested, and not to be reported as passing until done:

- Sign-in with two real Microsoft accounts, and the procedure above on the live site.
- Outlook mail and calendar against a real mailbox, including today's meetings in the bell. The bell was tested with calendar data placed in the browser's cache.
- Gemini summaries in this build.
- SharePoint, which is not built.
- A database recovery on Azure itself. The copy was checked locally by opening it.

Known limits:

- The drawer's Overview tab fits at 1440×900 and larger. At 1366×768 and 1280×720 it still scrolls 41 and 89 pixels, because the fields do not fit there.
- Excel import creates rows as it did before. Rows are reviewed in its existing dialog, and a contact matching an existing email or name and company is skipped.
- Relationship edits and the Deal Lead roster save to this browser first and then reach the server. They show an error and retry if the server is down, but are not undone on screen the way deals, tasks and documents are.
- Real-time means polling every 10 seconds. There is no live connection.
