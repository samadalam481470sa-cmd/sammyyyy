import { spawn } from 'node:child_process'

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
