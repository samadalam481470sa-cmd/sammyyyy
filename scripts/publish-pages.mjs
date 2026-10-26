#!/usr/bin/env node
/**
 * Build the GitHub Pages bundle and publish dist/ to the gh-pages branch.
 * Live site: https://samadalam481470sa-cmd.github.io/sammyyyy/
 *
 * Usage: npm run deploy:pages
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (cmd, args, cwd) => execFileSync(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' })
const quiet = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: 'ignore' }).status

console.log('Building the GitHub Pages bundle…')
run(npm, ['run', 'build:desktop'])
copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')

const source = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()
const dir = mkdtempSync(join(tmpdir(), 'newport-pages-'))
const branch = `gh-pages-publish-${Date.now()}`
let worktreeAdded = false
try {
  run('git', ['fetch', 'origin', 'gh-pages'])
  run('git', ['worktree', 'add', '--force', '-b', branch, dir, 'FETCH_HEAD'])
  worktreeAdded = true
  for (const name of readdirSync(dir)) {
    if (name !== '.git') rmSync(join(dir, name), { recursive: true, force: true })
  }
  cpSync('dist', dir, { recursive: true })
  run('git', ['add', '-A'], dir)
  if (quiet('git', ['diff', '--cached', '--quiet'], dir) === 0) {
    console.log('The live site already has this build. Nothing to publish.')
  } else {
    run('git', ['commit', '-m', `Deploy ${source} to GitHub Pages`], dir)
    run('git', ['push', 'origin', 'HEAD:gh-pages'], dir)
    console.log('\nPublished. Live site: https://samadalam481470sa-cmd.github.io/sammyyyy/')
    console.log('GitHub Pages can take a minute. Then hard refresh (Cmd+Shift+R).')
  }
} finally {
  if (worktreeAdded) quiet('git', ['worktree', 'remove', '--force', dir])
  quiet('git', ['branch', '-D', branch])
  rmSync(dir, { recursive: true, force: true })
}
