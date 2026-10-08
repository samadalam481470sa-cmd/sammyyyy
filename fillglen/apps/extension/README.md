# Fillglen Chrome extension

TypeScript, React, Vite, and `@crxjs/vite-plugin`. Side panel is the live question window. Pop out opens the same view. A small on-page **Fg** button opens the panel.

**Download:** [fillglen-assistant.zip](https://github.com/samadalam481470sa-cmd/sammyyyy/raw/cursor/keep-applying-autofill-0208/fillglen-assistant.zip) (raw URL). Unzip and Load unpacked the `fillglen-assistant/` folder in `chrome://extensions`.

Paste a resume, then **Autofill & keep applying**. While Chrome stays open it fills fields, opens dropdowns, clicks Next, then Submit, then the next sourced job. Hit Stop to halt. LinkedIn is blocked.

Or build locally: `npm run build -w @fillglen/extension` and select `fillglen/apps/extension/dist`.

Host access is limited to Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, and Workday. LinkedIn is not in the match list and is blocked in code.
