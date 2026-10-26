import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const seed = spawnSync(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'tsconfig.app.json', 'scripts/write-portable-seed.ts'],
  { stdio: 'inherit' },
)
if (seed.status !== 0) {
  console.error('Could not write public/database/newport-crm.json')
  process.exit(seed.status ?? 1)
}

const windows = readFileSync('public/download/Install-Newport-CRM.cmd', 'utf8')
const mac = readFileSync('public/download/Install-Newport-CRM.command', 'utf8')
if (!windows.includes('https://samadalam481470sa-cmd.github.io/sammyyyy/') || !mac.includes('https://samadalam481470sa-cmd.github.io/sammyyyy/')) {
  console.error('Desktop downloaders are missing the live app URL.')
  process.exit(1)
}

const env = {
  ...process.env,
  GH_PAGES: '1',
  VITE_STATIC_DEMO: '1',
  VITE_APP_ENV: process.env.VITE_APP_ENV || 'production',
}

const child = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
