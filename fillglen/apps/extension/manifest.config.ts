import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Fillglen",
  version: "0.1.0",
  description: "Live question window for job applications. After Start, keep applying fills, signs up, uses last resume, submits, and continues 24/7 while Chrome is open. Never LinkedIn Easy Apply. Never solves CAPTCHAs.",
  icons: {
    "16": "public/icon16.png",
    "32": "public/icon32.png",
    "48": "public/icon48.png",
    "128": "public/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Fillglen",
    default_icon: {
      "16": "public/icon16.png",
      "32": "public/icon32.png",
    },
  },
  side_panel: {
    default_path: "src/panel/index.html",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  permissions: ["storage", "unlimitedStorage", "sidePanel", "scripting", "tabs", "windows", "webNavigation", "alarms", "notifications", "offscreen"],
  host_permissions: ["http://127.0.0.1:8787/*", "http://localhost:8787/*", "https://*/*"],
  content_scripts: [
    {
      matches: ["https://*/*"],
      exclude_matches: [
        "https://www.linkedin.com/*",
        "https://linkedin.com/*",
        "https://*.linkedin.com/*",
        "https://www.youtube.com/*",
        "https://*.youtube.com/*",
        "https://www.facebook.com/*",
        "https://*.facebook.com/*",
        "https://www.instagram.com/*",
        "https://mail.google.com/*",
        "https://www.google.com/*",
        "https://google.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_start",
      all_frames: true,
    },
    {
      matches: ["https://accounts.google.com/*"],
      js: ["src/content/googleAccount.ts"],
      run_at: "document_start",
      all_frames: true,
    },
  ],
});
