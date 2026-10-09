# Job Finder — multi-user web service

A self-hostable web app where **any user can upload a resume** and get a
private, continuously-updated shortlist of matching jobs, with per-role resume
tweaks and cover-letter drafts to review.

One Node process does both jobs:

1. **Upload UI** at `/` — a user pastes or uploads (`.txt`) their resume, sets
   a few filters, and gets a private results URL (`/u/<id>`).
2. **Built-in scheduler** — re-scans the public job APIs every few hours and
   refreshes every user's matches. As long as the process is running, it
   "runs 24/7".

No npm dependencies — it uses only the Node standard library and reuses the
scoring/tailoring engine from [`../job-finder`](../job-finder) (the same logic
the Chrome extension uses in the browser).

## What this web service does not do

It discovers and prepares. Applying — sign up, last resume, submit, 24/7 while
Chrome is open — is Fillglen (`../fillglen/apps/extension`) after you hit
**Autofill & keep applying**. This process never invents skills or experience
and does not scrape LinkedIn.

## Run it

```bash
# From the repo root
npm start
# or: node web/server.js
```

Then open http://localhost:3000.

### With Docker (recommended for always-on)

```bash
docker build -t job-finder .
docker run -d --name job-finder -p 3000:3000 \
  -v job-finder-data:/app/job-finder/users \
  -e RUN_INTERVAL_HOURS=6 \
  job-finder
```

The named volume persists uploaded resumes and results across restarts.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `RUN_INTERVAL_HOURS` | `6` | Hours between automatic re-scans |
| `RUN_ON_START` | `true` | Run one discovery cycle immediately on startup |
| `ADMIN_TOKEN` | _(unset)_ | If set, `POST /admin/run` requires `?token=...` |
| `JOB_FINDER_USERS_DIR` | `job-finder/users` | Where uploaded resumes/results are stored |

Which job boards are scanned and the default filters come from
[`job-finder/config.json`](../job-finder/config.json). Per-user filters
(title include/exclude, location exclude, min score, remote-only) are collected
on the upload form and override the defaults for that user.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Upload form |
| POST | `/upload` | Create a user from a submitted resume; redirects to `/u/<id>` |
| GET | `/u/<id>` | A user's private results page |
| GET | `/healthz` | Health check (JSON) |
| POST | `/admin/run` | Trigger a discovery cycle now (guarded by `ADMIN_TOKEN` if set) |

## Privacy & security

- Uploaded resumes contain other people's personal data. They are stored under
  `job-finder/users/`, which is **git-ignored** — never commit it.
- A results URL contains an unguessable id that acts as the user's capability
  token. There is no login system.
- This is a personal/self-host tool. If you expose it to the public internet,
  put it behind your own authentication and HTTPS, and treat the stored
  resumes as the sensitive data they are.

## Tests

```bash
npm test            # from repo root; includes web/test + job-finder/test
```

The web tests cover the upload flow, the results page, input validation,
path-traversal protection on user ids, and HTML escaping of user-supplied
input.
