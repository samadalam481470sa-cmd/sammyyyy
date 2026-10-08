# Auto-Apply (human-in-the-loop)

Finds jobs on **Greenhouse / Lever / Ashby** career pages every hour, scores them, fills applications in a real Chromium browser, and tracks everything on a local dashboard.

**Dry-run is on by default** (`rules.json` → `"dryRun": true`). The bot fills forms and takes screenshots but never clicks Submit until you turn that off.

## What this deliberately does not do

- No CAPTCHA solving, fingerprint spoofing, or rotating proxies  
- No LinkedIn / Indeed automation  
- No inventing facts — missing answers go to `needs_human` or `awaiting_review`  
- Sensitive questions (auth, sponsorship, salary, EEO, etc.) only from your profile / saved answers  

Staying in good standing comes from company career pages, daily/company caps, and pausing for you when a site asks you to prove you are human.

## Quick start

```bash
cd auto-apply
npm install
npx playwright install chromium

cp config/profile.example.json config/profile.json
# Edit profile.json — replace every FILL_ME

cp .env.example .env
# Optional: OPENAI_API_KEY / ANTHROPIC_API_KEY for drafted open answers
# Optional: NOTIFY_WEBHOOK for Discord/Slack alerts

npm start
```

Then open the dashboard: **http://127.0.0.1:3000**

| Command | Purpose |
|---|---|
| `npm start` / `npm run worker` | 24/7 loop: hourly discovery + apply worker + dashboard |
| `npm run discover` | One-shot discovery |
| `npm run match` | Score `new` jobs → `matched` |
| `npm run dashboard` | Dashboard only |
| `npm test` | Unit tests |
| `npm run electron` | Tray app wrapper (after `npm run build`) |

## Status flow

`new` → `matched` → (`drafted` in dry-run) / `awaiting_review` / `needs_human` / `unsupported` → `approved` → `submitted`

Auto-submit (only when `dryRun: false`) happens only if **every** field came from your profile or a previously approved saved answer, and there is no CAPTCHA.

## Caps (`config/rules.json`)

- `dailyCap` (default 15)  
- `maxPerCompanyPerWeek` (default 2)  
- `minutesBetweenApplications` (default 10)  
- HTTP 429 / block pages pause that host for 24 hours  

## 24/7 hosting

**Home machine (recommended):** install, set OS to never sleep, run with PM2 or the Electron app (`openAtLogin`).

```bash
npm i -g pm2
pm2 start "npx tsx src/worker.ts" --name auto-apply --cwd "$(pwd)"
pm2 save && pm2 startup
```

**Docker / cloud:** possible, but expect more CAPTCHAs from data-center IPs — those jobs land in `needs_human` for you.

## Launch checklist

- [ ] `profile.json` filled (no `FILL_ME` left)  
- [ ] `companies.json` lists employers you want  
- [ ] Caps low for week one  
- [ ] Dry-run screenshots look correct on Greenhouse, Lever, and Ashby  
- [ ] Review dashboard approve / skip works  
- [ ] Alerts arrive when `NOTIFY_WEBHOOK` is set  
- [ ] Only then set `"dryRun": false`  

## Layout

See the build plan. Sensitive files are gitignored: `.env`, `config/profile.json`, `browser-profile/`, `screenshots/`, `auto-apply.db`.
