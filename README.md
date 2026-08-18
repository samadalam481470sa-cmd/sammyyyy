# Job search toolkit

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

Install: download `resume-fit-assistant.zip`, unzip, then `chrome://extensions`
→ Developer mode → **Load unpacked** → select the `chrome-extension/` folder.
See [`chrome-extension/README.md`](chrome-extension/README.md).

## 2. `job-finder/` — scheduled discovery pipeline

A dependency-free Node script wired to `.gitlab-ci.yml`. On a GitLab CI
schedule (every few hours, on GitLab's runners, so it runs with your laptop
closed) it pulls postings from public job APIs, scores each against your
resume, and publishes ranked shortlists, per-role resume-tailoring plans, and
cover-letter drafts as downloadable artifacts.

Setup and configuration: [`job-finder/README.md`](job-finder/README.md).

## Where the line is

These tools do discovery, matching, tailoring, and form-filling. They do not:

- **submit applications autonomously** — automated submission breaches the
  Terms of Service of essentially every job board and ATS, and risks your
  accounts mid-search;
- **invent facts** — unknown fields are filled from data you provided, drafted
  from your real resume and marked for review, or left blank and flagged.
  Gap lists are shown as gaps, never quietly filled in;
- **evade bot detection** — no synthetic mouse movement or similar tricks.

The human stays the one who reviews and clicks submit. Everything else is
automated.
