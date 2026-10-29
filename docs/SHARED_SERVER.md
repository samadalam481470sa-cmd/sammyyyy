# Shared workspace server (multi-user saving)

Without a server, each browser keeps its own copy of the CRM. With the server, every approved
Newport user reads and writes the same records, files, and document types.

## Security model
- People sign in with Microsoft as before. The browser sends the Microsoft ID token to the
  server, which checks the signature against Microsoft's published keys, the audience (this
  app's client ID), the issuing tenant, and the expiry.
- Only approved people get in. Set `ALLOWED_EMAIL_DOMAINS`, `ALLOWED_EMAILS`,
  `ALLOWED_TENANT_IDS`, or `ADMIN_EMAILS`. With none set, the server refuses everyone.
- The server issues a 12-hour session token, kept only in that browser tab and erased at logout.
- Credential-free demo sign-in is disabled unless `ALLOW_DEMO_SIGNIN=1` (local development only).
- Viewer accounts can read but not change records. All writes are audit-logged.
- Rate limits apply per signed-in session, so a whole office behind one network is not throttled.

## Deploy (about 15 minutes)
Any host that runs Docker with a persistent disk works. Two options:

**Render** (uses `render.yaml`; Starter plan with a 1 GB disk)
1. render.com → New → Blueprint → connect the `sammyyyy` repository.
2. Set `ALLOWED_EMAIL_DOMAINS` (for example `newportspecialty.com`) and/or `ALLOWED_EMAILS`, and `ADMIN_EMAILS`.
3. Deploy. Copy the service URL, for example `https://newport-crm-api.onrender.com`.

**Azure App Service** (Linux, container): build `Dockerfile.api`, set the same settings, and set
`CRM_DB_PATH=/home/data/newport-crm.db` (the `/home` folder persists on App Service).

## Point the CRM at the server
Edit `public/api.json`:
```json
{ "apiBase": "https://newport-crm-api.onrender.com" }
```
Commit and publish (`npm run deploy:pages`). The build adds the server to the page's security policy.
From then on, sign-in requires the server to approve the person, and saves show "Saved for everyone".

The first approved person to sign in uploads their current records as the shared starting data.
Back up the disk regularly (the database is one file at `CRM_DB_PATH`).
