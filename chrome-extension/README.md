# Resume-Fit Autofill Assistant (Chrome Extension)

A Chrome extension that helps with job applications **without** crossing into
fraud or platform-abuse territory. It:

- Lets you save your **real** resume (paste text or upload a `.txt` file), parsed
  into structured fields you can review and correct.
- Lets you pre-write your **own answers** to recurring questions (work
  authorization, visa sponsorship, salary expectations, notice period, etc.)
  once, in the **Q&A** tab. Whenever a matching question shows up on a page —
  even reworded — it's filled in with your exact wording. This works for text
  fields, dropdowns, checkboxes, and yes/no radio-button questions.
- On any job page, autofills form fields it can confidently match (name, email,
  phone, links, skills, your saved Q&A answers, etc.) using **only** your real
  data — never invented facts.
- For open-ended prompts with no saved Q&A answer (like "Why do you want to
  work here?" or a cover-letter box), **drafts a short suggestion** built only
  from your real resume content (summary/skills/experience). Drafts are
  highlighted in blue and clearly marked "review & personalize before
  submitting" — they're a starting point, not a final answer, and nothing is
  ever submitted automatically.
- Highlights anything it still can't confidently handle — like legally
  sensitive checkboxes/radios you haven't pre-answered — in yellow, so **you**
  answer them yourself.
- Shows a **job-fit score**: keyword overlap between your resume and the
  posting's description, plus which keywords are matched vs. missing.
- Never auto-submits an application and never simulates mouse movement or any
  other bot-detection evasion.
- Includes a small **floating helper bubble** ("RF") that appears in the
  corner of every page (draggable, and can be turned off from the popup).
  Click it for one-click actions: Fill Name, Fill Email, Fill Phone, and Full
  Autofill + Job Score — all using the engine described above.

## What this deliberately does NOT do

This project intentionally does **not** implement:

- Autonomous/continuous submission of applications without a human reviewing
  each one.
- Fabricating answers to questions it doesn't know (work authorization,
  salary expectations, cover letters, etc.) — these are always left blank and
  flagged for you.
- Any mouse-movement simulation or other technique aimed at evading a site's
  bot/anti-fraud detection.

Most job boards and ATS platforms (LinkedIn, Indeed, Greenhouse, Lever,
Workday, etc.) prohibit automated/scripted account activity in their Terms of
Service, and providing false information on an application can constitute
fraud. This tool is designed to stay on the right side of both: it's a
review-and-autofill assistant, not an autonomous applicant.

## Download & install on macOS

1. Download `resume-fit-assistant.zip` (built from this folder — see below if
   you need to rebuild it) and unzip it. On macOS, double-click the `.zip` in
   Finder (or run `unzip resume-fit-assistant.zip`) — you'll get a
   `chrome-extension/` folder.
2. Open Chrome and go to `chrome://extensions`.
3. Toggle on **Developer mode** (top-right switch).
4. Click **Load unpacked** and select the unzipped `chrome-extension/` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin "Resume-Fit
   Autofill Assistant").
6. Click its icon, go to the **Resume** tab, and paste or upload your resume.
7. Optionally add answers to common questions in the **Q&A** tab.
8. On any page, either open the popup's **Fill & Score** tab and click
   **Analyze & Fill This Page**, or click the small floating **"RF"** bubble
   in the corner of the page for quick one-click actions.

No build step, no external dependencies — it's plain HTML/CSS/JS (Manifest
V3), so you can also just copy individual files straight into your own
extension project.

### Rebuilding the zip

From the repository root:

```bash
cd chrome-extension
zip -r ../resume-fit-assistant.zip . -x "*.DS_Store"
```

## File structure

```
chrome-extension/
├── manifest.json          # Manifest V3 config
├── popup.html/.css/.js    # Resume + Q&A input UI, "Analyze & Fill This Page" trigger
├── content.js             # Injected on demand (popup button / context menu)
├── widget.js              # Always-on floating "RF" bubble injected on every page
├── background.js          # Service worker; adds a right-click "Fill this page" shortcut
└── lib/
    ├── resumeParser.js    # Heuristic resume-text -> structured profile parser
    ├── matcher.js         # Resume vs. job-description keyword overlap scoring
    └── autofillEngine.js  # Shared field-matching/autofill logic
```

## The floating widget

A small draggable "RF" bubble appears in the bottom-right corner of every
page (turn it off from the popup's **Fill & Score** tab if you don't want
it). Clicking it opens a panel with:

- **Fill Name / Fill Email / Fill Phone** — fills every matching field on the
  page with that piece of your saved resume data.
- **Full Autofill + Job Score** — runs the same engine as the popup's
  "Analyze & Fill This Page" button.

The widget only fills fields when you click a button — it never runs
automatically in the background, never submits anything, and never moves
your mouse or clicks other page elements.

## Notes & limitations

- PDF/Word resumes aren't parsed directly — open the file, copy the text, and
  paste it into the extension (or export to `.txt` first).
- Field matching is heuristic (label/placeholder/name keyword matching). Always
  review a page after auto-fill before applying.
- The job-fit score is a simple keyword-overlap heuristic, not a semantic or
  ML-based match — treat it as a quick signal, not ground truth.
- Content scripts only run when you explicitly click "Analyze & Fill This
  Page" (or the right-click menu item) — nothing runs in the background or on
  page load.
