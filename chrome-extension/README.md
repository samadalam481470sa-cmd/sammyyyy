# Resume-Fit Autofill Assistant (Chrome Extension)

A Chrome extension that helps with job applications **without** crossing into
fraud or platform-abuse territory. It:

- Lets you save your **real** resume (paste text or upload a `.txt` file), parsed
  into structured fields you can review and correct.
- On any job page, autofills form fields it can confidently match (name, email,
  phone, links, skills, etc.) using **only** your real saved data.
- Highlights fields it *can't* confidently match — including checkboxes/radios
  like work authorization, and free-text prompts like "why do you want this
  job?" or "cover letter" — in yellow, so **you** answer them yourself.
- Shows a **job-fit score**: keyword overlap between your resume and the
  posting's description, plus which keywords are matched vs. missing.
- Never auto-submits an application and never simulates mouse movement or any
  other bot-detection evasion.

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

## How to load it in Chrome

1. Open `chrome://extensions` in Chrome.
2. Toggle on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this `chrome-extension/` folder.
5. Pin the extension, click its icon, and go to the **Resume** tab to paste or
   upload your resume.
6. On any job application page, open the popup, go to **Fill & Score**, and
   click **Analyze & Fill This Page**.

No build step, no dependencies — it's plain HTML/CSS/JS (Manifest V3), so you
can also just copy individual files (`manifest.json`, `popup.html`,
`popup.css`, `popup.js`, `content.js`, `background.js`, `lib/resumeParser.js`,
`lib/matcher.js`) straight into your own extension project.

## File structure

```
chrome-extension/
├── manifest.json        # Manifest V3 config (permissions: storage, activeTab, scripting, contextMenus)
├── popup.html/.css/.js  # Resume input UI + "Analyze & Fill This Page" trigger
├── content.js           # Injected on demand; fills/flags fields, shows fit score panel
├── background.js        # Service worker; adds a right-click "Fill this page" shortcut
└── lib/
    ├── resumeParser.js  # Heuristic resume-text -> structured profile parser
    └── matcher.js       # Resume vs. job-description keyword overlap scoring
```

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
