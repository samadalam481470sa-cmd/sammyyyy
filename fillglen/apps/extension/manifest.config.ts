import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Fillglen",
  version: "0.1.0",
  description: "Live question window for job applications. Fills from your profile. Never submits. Never runs on LinkedIn Easy Apply.",
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
  permissions: ["storage", "sidePanel", "scripting", "tabs", "windows", "webNavigation"],
  host_permissions: [
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.ashbyhq.com/*",
    "https://*.smartrecruiters.com/*",
    "https://*.icims.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.workday.com/*",
  ],
  content_scripts: [
    {
      matches: [
        "https://*.greenhouse.io/*",
        "https://*.lever.co/*",
        "https://*.ashbyhq.com/*",
        "https://*.smartrecruiters.com/*",
        "https://*.icims.com/*",
        "https://*.myworkdayjobs.com/*",
        "https://*.workday.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_end",
      all_frames: true,
    },
  ],
});
