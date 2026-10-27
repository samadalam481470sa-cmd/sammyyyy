import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { desktopManifest, desktopServiceWorkerSource } from './src/lib/desktopApp.js'

function productionCsp(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://login.microsoftonline.com https://login.live.com https://login.microsoft.com https://graph.microsoft.com https://aadcdn.msauth.net https://aadcdn.msftauth.net https://accounts.google.com https://oauth2.googleapis.com https://gmail.googleapis.com https://www.googleapis.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://accounts.google.com https://login.microsoftonline.com https://login.live.com https://login.microsoft.com https://teams.microsoft.com https://zoom.us https://meet.google.com https://webex.com https://web.skype.com",
    "base-uri 'self'",
    "form-action 'self' https://login.microsoftonline.com https://login.live.com https://login.microsoft.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
  return {
    name: 'newport-production-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html
      return html.replace(
        '<head>',
        `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta http-equiv="Permissions-Policy" content="camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" />`,
      )
    },
  }
}

function desktopPackage(): Plugin {
  let base = '/'
  let outDir = 'dist'
  return {
    name: 'newport-desktop-package',
    apply: 'build',
    configResolved(config) {
      base = config.base
      outDir = config.build.outDir
    },
    closeBundle() {
      const dir = resolve(outDir)
      writeFileSync(resolve(dir, 'manifest.webmanifest'), `${JSON.stringify(desktopManifest(base), null, 2)}\n`)
      writeFileSync(resolve(dir, 'sw.js'), desktopServiceWorkerSource())
    },
  }
}

export default defineConfig({
  // GH_PAGES wins so the installed window is scoped to /sammyyyy/ even when the static demo flag is also set.
  // STATIC_DEMO alone stays path-agnostic for other CDNs.
  base: process.env.GH_PAGES ? '/sammyyyy/' : process.env.STATIC_DEMO ? './' : '/',
  plugins: [react(), tailwindcss(), productionCsp(), desktopPackage()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    minify: true,
    // Inline the Newport logo into the JS bundle so CDN demos don't rely on
    // relative image fetches (many raw CDNs serve HTML as text/plain or rate-limit assets).
    assetsInlineLimit: process.env.STATIC_DEMO || process.env.GH_PAGES ? 200_000 : 4096,
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
