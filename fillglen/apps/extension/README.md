# Fillglen Chrome extension

TypeScript, React, Vite, and `@crxjs/vite-plugin`. Side panel is the live question window. Pop out opens the same view. A small on-page **Fg** button opens the panel.

**Download:** [fillglen-assistant.zip](https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/keep-applying-autofill-0208/fillglen-assistant.zip) (raw URL). Unzip and Load unpacked the `fillglen-assistant/` folder in `chrome://extensions`.

Paste a resume, then **Autofill & keep applying**. Jobs are ranked to that resume. While the widget is on, Fillglen also scans Texas map tiles (OpenStreetMap; Google Maps is not scraped) and checks public career sites in the background. The API continues 24/7 if it is running. A CAPTCHA waits for you — Fillglen never solves it. Hit Stop to halt. LinkedIn is blocked.

Or build locally: `npm run build -w @fillglen/extension` and select `fillglen/apps/extension/dist`.

Autofill runs on the major US applicant systems (Workday, Greenhouse, Lever, Ashby, Taleo, SuccessFactors, iCIMS, Jobvite, BambooHR, ADP, UKG, Paycom, Paylocity, Dayforce, Phenom, Eightfold, Avature, Rippling, JazzHR, and others) plus generic company `/apply` forms. LinkedIn Easy Apply is blocked. Search prefers Texas IT roles, then other United States openings from public feeds — not every company in Texas.
