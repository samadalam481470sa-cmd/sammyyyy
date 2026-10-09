# Fillglen Chrome extension

TypeScript, React, Vite, and `@crxjs/vite-plugin`. Side panel is the live question window. Pop out opens the same view. A small on-page **Fg** button opens the panel.

**Download:** [fillglen-assistant.zip](https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/keep-applying-autofill-0208/fillglen-assistant.zip) (raw URL). Unzip and Load unpacked the `fillglen-assistant/` folder in `chrome://extensions`.

Paste a resume, then **Autofill & keep applying**. Jobs are ranked to that resume. The popup **Live jobs** button opens the list Fillglen keeps filling in the background while Chrome is open. Open a job after you finish an application, or leave the rows there — they stay saved, including ones you already applied to. **Database** in the same widget searches the in-app store (jobs, employers, harvest ticks) so you can fetch a title or company later. While the widget is on, Fillglen also scans Texas map tiles (OpenStreetMap; Google Maps is not scraped) and checks public career sites in the background. The API continues 24/7 if it is running. Unknown form questions use the resume; if it is not on the resume the answer is No. A CAPTCHA waits for you — Fillglen never solves it. Hit Stop to halt. LinkedIn is blocked. Every popup field is saved in `chrome.storage.local`. The database uses IndexedDB (`unlimitedStorage`) and dual-writes the compact Live jobs list that was already there.

Or build locally: `npm run build -w @fillglen/extension` and select `fillglen/apps/extension/dist`.

Autofill runs on the major US applicant systems (Workday, Greenhouse, Lever, Ashby, Taleo, SuccessFactors, iCIMS, Jobvite, BambooHR, ADP, UKG, Paycom, Paylocity, Dayforce, Phenom, Eightfold, Avature, Rippling, JazzHR, and others) plus generic company `/apply` forms. LinkedIn Easy Apply is blocked. Search prefers Texas IT roles, then other United States openings from public feeds — not every company in Texas.
