import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

function productionCsp(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://teams.microsoft.com https://zoom.us https://meet.google.com https://webex.com https://web.skype.com",
    "base-uri 'self'",
    "form-action 'self'",
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
    <meta http-equiv="Permissions-Policy" content="camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" />`,
      )
    },
  }
}

export default defineConfig({
  // GH_PAGES: served from https://<user>.github.io/sammyyyy/
  // STATIC_DEMO: path-agnostic build for CDN hosting (relative assets + hash routing)
  base: process.env.STATIC_DEMO ? './' : process.env.GH_PAGES ? '/sammyyyy/' : '/',
  plugins: [react(), tailwindcss(), productionCsp()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Inline the Newport logo into the JS bundle so CDN demos don't rely on
    // relative image fetches (many raw CDNs serve HTML as text/plain or rate-limit assets).
    assetsInlineLimit: process.env.STATIC_DEMO ? 200_000 : 4096,
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
