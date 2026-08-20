# Resume-Fit Autofill Assistant (Chrome Extension)

A Chrome extension that helps with job applications **without** crossing into
fraud or platform-abuse territory. It:

- Lets you save your **real** resume (paste text or upload a `.txt` file), parsed
  into structured fields you can review and correct — including name, contact
  info, city/state/ZIP, LinkedIn/GitHub, current title & employer, school,
  degree, graduation year, and years of experience.
- **Saves everything automatically as you type.** All data lives in
  `chrome.storage.local` — on your device, no account or cloud — and persists
  across page navigations and browser restarts. The popup window itself closes
  whenever you click away (that's how Chrome popups work), but your data is
  never lost, and the floating bubble keeps the assistant available on every
  page.
- Lets you pre-write your **own answers** to recurring questions (work
  authorization, visa sponsorship, salary expectations, notice period, etc.)
  once, in the **Q&A** tab. Whenever a matching question shows up on a page —
  even reworded — it's filled in with your exact wording. This works for text
  fields, dropdowns, checkboxes, and yes/no radio-button questions.
- On any job page, autofills form fields it can confidently match (name, email,
  phone, links, skills, your saved Q&A answers, etc.) using **only** your real
  data — never invented facts.
- For open-ended prompts with no saved Q&A answer, **drafts a suggestion** built
  from your real resume content. This now covers both **behavioral / "filler"
  questions** (why this role, tell us about yourself, greatest strength, why
  should we hire you, etc.) and **technical questions** (experience with X,
  describe your background, what technologies you use), highlighting the skills
  from your resume that match the posting. Drafts are highlighted in blue and
  clearly marked "review & personalize before submitting" — a starting point,
  not a final answer, and nothing is ever submitted automatically.
- **Standard self-ID (EEO) answers**: set once in the Q&A tab and they fill
  automatically — pre-seeded with **"I am not a protected veteran"** and **"No,
  I do not have a disability."** Edit or clear any of them (including gender /
  race, left blank by default) to answer yourself instead.
- **Jobs tab**: pulls **real, currently-open** listings from public job APIs,
  ranks them against your resume, and biases toward your **ZIP code area** plus
  US-remote roles. A fresh batch (up to 40) is prepared automatically a couple
  of times a day whenever Chrome is open, so there are openings waiting each
  morning. Click one to open it, then fill it in seconds with the assistant.
- Highlights anything it still can't confidently handle — like legally
  sensitive checkboxes/radios you haven't pre-answered — in yellow, so **you**
  answer them yourself.
- Shows a **job-fit score**: keyword overlap between your resume and the
  posting's description, plus which keywords are matched vs. missing.
- Never auto-submits an application and never simulates mouse movement or any
  other bot-detection evasion.
- Includes a small **floating helper bubble** ("RF") that appears in the
  corner of every page (draggable, and can be turned off from the popup).
  Click it for one-click actions: Fill Name, Fill Email, Fill Phone, **Fill
  Contact Info** (all contact fields at once), and Full Autofill + Job Score —
  all using the engine described above. Its position and open/closed state are
  remembered, so it stays where you put it as you move page to page.
- Fills fast with a **keyboard shortcut**: press **Alt+Shift+F** on any page to
  run a full autofill instantly — no need to open the popup or the bubble. You
  can change the shortcut at `chrome://extensions/shortcuts`.

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

### Step 1 — get the zip

Download it directly (right-click → Save Link As, or just click):

**https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/job-application-assistant-extension-0208/resume-fit-assistant.zip**

The `raw/` URL matters. If you open the file's normal GitHub *page* and use
"Save As", you'll save the HTML page instead of the zip, and Chrome will
reject it. Also note the file lives on the
`cursor/job-application-assistant-extension-0208` branch — it isn't on `main`
until that branch is merged.

Verify you got a real archive (should print `Zip archive data`):

```bash
file ~/Downloads/resume-fit-assistant.zip
```

### Step 2 — unzip it

Double-click the `.zip` in Finder. You get **one folder named
`resume-fit-assistant`**, containing `manifest.json` at its top level. That
folder is what Chrome needs.

### Step 3 — load it in Chrome

1. Go to `chrome://extensions`.
2. Toggle on **Developer mode** (top-right switch). Without this, the
   **Load unpacked** button doesn't appear at all.
3. Click **Load unpacked**.
4. Select the **`resume-fit-assistant` folder itself** — not its parent
   folder, and not a file inside it. If Chrome says *"Manifest file is
   missing or unreadable"*, you selected the wrong level; open the folder and
   confirm you can see `manifest.json` directly inside it.
5. Pin the extension: puzzle-piece icon in the toolbar → pin "Resume-Fit
   Autofill Assistant".

### Step 4 — set it up

1. Click the extension icon → **Resume** tab → paste or upload your resume →
   **Save Resume Profile**.
2. Optional but worth it: **Q&A** tab → add your answers to recurring
   questions (work authorization, salary expectations…) → **Save Q&A**.
3. On any application page, either use the popup's **Fill & Score** tab, or
   click the floating **"RF"** bubble in the page corner.

Already have the repo cloned? Skip the zip entirely and point **Load
unpacked** at the `chrome-extension/` folder directly.

### Rebuilding the zip

From the repository root:

```bash
node scripts/build-extension.js
```

This validates the package before zipping — it checks the manifest, confirms
every file referenced by the manifest, by `popup.html`, and by
`chrome.scripting.executeScript` actually exists, and syntax-checks all JS.
It then produces a zip containing a single top-level `resume-fit-assistant/`
folder, so there's no ambiguity about what to select in Chrome.

### Verifying it actually works

```bash
npm install --no-save playwright && npx playwright install chromium
node chrome-extension/test/smoke-test.js
```

This loads the extension in a real Chromium, serves a fake application form,
and asserts the widget injects and fills first/last name, email, phone,
LinkedIn, a drafted cover letter, and a saved Q&A radio answer. Pass a path
to test a built package instead of the source folder:

```bash
node chrome-extension/test/smoke-test.js ~/Downloads/resume-fit-assistant
```

## File structure

```
chrome-extension/
├── manifest.json          # Manifest V3 config
├── popup.html/.css/.js    # Resume + Q&A input UI, "Analyze & Fill This Page" trigger
├── content.js             # Injected on demand (popup button / shortcut / context menu)
├── widget.js              # Always-on floating "RF" bubble injected on every page
├── background.js          # Service worker; menu + shortcut + scheduled job refresh
├── lib/
│   ├── resumeParser.js    # Heuristic resume-text -> structured profile parser
│   ├── matcher.js         # Resume vs. job-description keyword overlap scoring
│   ├── tailor.js          # Per-role resume-tailoring suggestions (real content only)
│   ├── jobFetcher.js      # Public job-API fetch + ZIP-aware ranking (Jobs tab)
│   └── autofillEngine.js  # Shared field-matching/autofill logic
└── test/smoke-test.js     # Loads the extension in real Chromium and fills a form
```

## The Jobs tab (fresh listings near you)

Enter your ZIP code and the extension pulls **real, open** postings from public
job APIs (Remote OK, plus Greenhouse / Lever / Ashby company boards — the same
public endpoints those companies link from their own careers pages), scores each
against your saved resume with the same matcher used on-page, and ranks them.

Set **Target areas** (comma-separated states or cities) to focus the search;
the default is `FL, CA, DC, Chicago, IL, CO, Phoenix, AZ` plus your ZIP's state.
Listings are balanced across those areas (round-robin, best-scored first) and
combined with US-remote roles, so every area you list is represented rather than
one metro filling the whole list. Up to 40 are shown.

A background schedule (via `chrome.alarms`) refreshes the batch about twice a day
and again when you start Chrome, so there are fresh listings each morning
**while Chrome is running**. A browser extension can't run with the browser fully
closed — for true laptop-closed 24/7 discovery, the repo's `job-finder/` GitLab
CI pipeline runs on a server schedule and emails/publishes the same kind of
shortlist.

Nothing here submits anything or logs into any site; it only reads public
listing APIs and opens the links you click.

## The floating widget

A small draggable "RF" bubble appears in the bottom-right corner of every
page (turn it off from the popup's **Fill & Score** tab if you don't want
it). Clicking it opens a panel with:

- **Fill Name / Fill Email / Fill Phone** — fills every matching field on the
  page with that piece of your saved resume data.
- **Fill Contact Info** — fills all your contact fields (name, email, phone,
  city/state/ZIP, address, LinkedIn/GitHub, website) in one click.
- **Full Autofill + Job Score** — runs the same engine as the popup's
  "Analyze & Fill This Page" button.

The bubble remembers where you drag it and whether its panel was open, so it
stays consistent as you navigate between pages.

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
- Autofill only runs when you explicitly trigger it — the popup button, the
  **Alt+Shift+F** shortcut, the floating bubble, or the right-click menu item.
  The floating bubble is injected on page load but only reads/writes fields
  when you click one of its buttons; nothing fills or submits on its own.
