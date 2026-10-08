# Job search toolkit

**Fillglen** (`fillglen/`) is the full platform: TypeScript/React/Vite Chrome extension with a live side-panel question window, Express API, dashboard, and 24/7 local job finder. It never submits, never invents facts, and never runs on LinkedIn Easy Apply. See [`fillglen/README.md`](fillglen/README.md).

**Download the Chrome extension:**
[**fillglen-assistant.zip**](https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/fillglen-platform-0208/fillglen-assistant.zip)
(use the `raw/` URL). Unzip, then `chrome://extensions` → Developer mode → Load unpacked → select the `fillglen-assistant/` folder.

**Download / deploy the whole platform:**
[**source zip**](https://github.com/samadalam481470sa-cmd/sammyyyy/archive/refs/heads/cursor/fillglen-platform-0208.zip)
or `git clone -b cursor/fillglen-platform-0208 https://github.com/samadalam481470sa-cmd/sammyyyy.git` then `cd fillglen && npm install && npm run dev:api && npm run dev:dashboard`.


Two components that work together to make applying to jobs fast, without
faking anything or fighting anti-bot systems.

## 1. `chrome-extension/` — Resume-Fit Autofill Assistant

A Manifest V3 Chrome extension. Save your resume once, then on any application
page it:

- autofills contact/basic fields from your real resume data;
- answers recurring questions (work authorization, salary expectations, etc.)
  using answers **you** typed once in its Q&A tab, matched even when the
  wording differs;
- drafts open-ended answers ("why do you want to work here?") from your real
  resume content, clearly marked for you to personalize;
- flags anything it can't confidently fill so you complete it yourself;
- shows a job-fit score and **per-role resume tweaks** — which of your existing
  skills and bullets to lead with for this specific posting;
- gives you a small draggable floating widget for one-click fills.

**Install:** download the zip with the
[**raw download link**](https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/job-application-assistant-extension-0208/resume-fit-assistant.zip)
(the `raw/` URL matters — saving the GitHub file *page* gives you HTML, not a
zip), unzip it to get a single `resume-fit-assistant/` folder, then
`chrome://extensions` → **Developer mode** on → **Load unpacked** → select
that folder. Full walkthrough and troubleshooting:
[`chrome-extension/README.md`](chrome-extension/README.md).

Rebuild the zip with `node scripts/build-extension.js` (validates the package,
then zips it).

## 2. `job-finder/` — scheduled discovery pipeline

A dependency-free Node script wired to `.gitlab-ci.yml`. On a GitLab CI
schedule (every few hours, on GitLab's runners, so it runs with your laptop
closed) it pulls postings from public job APIs, scores each against your
resume, and publishes ranked shortlists, per-role resume-tailoring plans, and
cover-letter drafts as downloadable artifacts.

Setup and configuration: [`job-finder/README.md`](job-finder/README.md).

## 3. `web/` — multi-user web service

A self-hostable web app (no npm dependencies) where **any user can upload a
resume** and get a private, continuously-updated shortlist. One process serves
the upload UI and runs a **built-in scheduler** that re-scans every few hours,
so it "runs 24/7" for as long as it's up — host it with Docker, systemd, pm2,
or a small VM. It reuses the same scoring/tailoring engine as the other two
components.

```bash
npm start            # serves http://localhost:3000
# or, always-on:
docker build -t job-finder . && docker run -d -p 3000:3000 \
  -v job-finder-data:/app/job-finder/users job-finder
```

Setup, routes, and privacy notes: [`web/README.md`](web/README.md).

## Where the line is

These tools do discovery, matching, tailoring, and form-filling. They do not:

- **submit applications autonomously** — automated submission breaches the
  Terms of Service of essentially every job board and ATS, and risks your
  accounts mid-search;
- **run "under the radar"** — the web service reads from documented public job
  APIs and makes no attempt to hide automated activity or evade bot detection
  (no synthetic mouse movement or similar tricks). Hiding automation is how
  accounts get banned, so it's a line this project won't cross;
- **invent facts** — unknown fields are filled from data you provided, drafted
  from your real resume and marked for review, or left blank and flagged.
  Gap lists are shown as gaps, never quietly filled in.

The human stays the one who reviews and clicks submit. Everything else is
automated.
