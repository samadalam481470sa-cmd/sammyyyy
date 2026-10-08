# Newport Acquisition CRM — agent notes

## Cursor Cloud specific instructions

### Always deploy the live demo after code changes

Whenever you finish a code change for this CRM, **also update the live GitHub Pages site**:

- Live URL: https://samadalam481470sa-cmd.github.io/sammyyyy/
- Pages source branch: `gh-pages` (legacy Pages, not GitHub Actions — the Actions workflow has been unreliable)

Deploy steps (run after the feature is committed on the working branch):

1. `STATIC_DEMO=1 VITE_STATIC_DEMO=1 npm run build`
2. `cp dist/index.html dist/404.html`
3. Publish `dist/` to `origin/gh-pages` (worktree or orphan update), include `.nojekyll`
4. Verify the live `index.html` references the new hashed assets and hard-refresh if CDN caches the old bundle

Do this for every meaningful CRM change in this repo — do not wait for the user to ask.

### Preferred PR flow

Prefer **one PR into `main`** that includes the feature work, rather than many small feature PRs, unless the user asks otherwise. Still push to `gh-pages` so the live link stays current even before merge.
