# Newport CRM desktop app

Cursor remains the only codebase. The installed Windows or Mac app is this same dashboard, opened in its own window.

## What was generated

`npm run build:desktop` writes `dist/` with:

- `manifest.webmanifest` (`display: standalone`, icons, scope `/sammyyyy/`)
- `sw.js` (network-first cache; Microsoft login is not cached)
- the existing React dashboard

No Windows `Setup.exe` and no Mac `.dmg` were produced. Those were not installed or code-signed in this environment. Edge and Chrome install the hosted site as a desktop app with an icon and its own window. That install keeps receiving dashboard updates from the next GitHub Pages deploy. A new installer is only needed if you later change the packaging itself.

## Daily workflow

1. Edit in Cursor.
2. `npm run dev` for live reload at http://localhost:5173.
3. `npm test` and `npm run build:desktop`.
4. Publish `dist/` to the `gh-pages` branch (see `AGENTS.md`).
5. Employees open the already installed Newport CRM window. The next online launch loads the new files. Unfinished local edits are not on that site until this deploy.

## Environments

| Name | How to run | Who sees it |
| --- | --- | --- |
| development | `npm run dev` | You, with live reload |
| staging | `VITE_APP_ENV=staging npm run build:desktop`, then publish that `dist/` to a staging host | Reviewers |
| production | `npm run build:desktop`, then `gh-pages` | Employees |

`VITE_APP_ENV` accepts `development`, `staging`, or `production`.

## Download

Anyone can download the launcher. Each person gets their own window and signs in with their own Microsoft account. Saved CRM edits stay on that computer.

- Windows: https://samadalam481470sa-cmd.github.io/sammyyyy/download/Install-Newport-CRM.cmd
- Mac: https://samadalam481470sa-cmd.github.io/sammyyyy/download/Install-Newport-CRM.command

The same links are on the sign-in screen. Windows creates a desktop shortcut named Newport CRM and opens Edge in its own window. Mac opens Edge, or Chrome if Edge is not installed. The shortcut always loads the live site, so a new GitHub Pages deploy is what employees get the next time they open the app while online.

Edge and Chrome can also install the site with **Install app**. That path was not clicked on a Windows PC here. The downloadable launcher files are what this environment generated and can re-check over HTTPS.

## Updates and rollback

Updates are the new `gh-pages` files. The service worker fetches the network copy first and keeps the previous shell only for offline use.

Rollback is a git rollback of `gh-pages` to the last good commit, then a push. Do not force-push unless you intend to drop the bad deploy. Employees pick up the restored files on the next online open. No reinstall is required for a dashboard-only rollback.

## Microsoft sign-in

Sign-in stays in `src/auth/`. `src/auth/activeProvider.ts` names the current provider as `microsoft`. Replacing it later means a new sign-in module behind `signInWithMicrosoft` in `AuthContext`. The Entra redirect URIs stay:

- `http://localhost:5173/`
- `https://samadalam481470sa-cmd.github.io/sammyyyy/`

## Code signing

This PWA install does not use an Authenticode certificate. If you later ship a real `.exe` or MSIX, you need:

- an OV or EV code-signing certificate
- `signtool` on Windows to sign the package
- a timestamp server so the signature survives certificate expiry

That signing step has not been done.

## Failures

Unexpected UI errors render a reload screen and append a redacted line to `sessionStorage` key `newport_crm_client_log_v1`. Query strings and bearer tokens are removed. Offline use keeps browser-saved CRM data and blocks Microsoft sign-in until the network returns.
