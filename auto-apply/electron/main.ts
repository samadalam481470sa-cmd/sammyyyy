import { app, BrowserWindow, Tray, Menu, powerSaveBlocker, utilityProcess } from "electron";
import path from "node:path";
import fs from "node:fs";

let tray: Tray | null = null;
let win: BrowserWindow | null = null;
let worker: Electron.UtilityProcess | null = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();

function workerEntry() {
  // Prefer compiled JS; fall back note for dev.
  const compiled = path.join(__dirname, "../src/worker.js");
  return compiled;
}

function startWorker() {
  const entry = workerEntry();
  if (!fs.existsSync(entry)) {
    console.error("Worker entry missing. Run npm run build first:", entry);
    return;
  }
  worker = utilityProcess.fork(entry, [], {
    env: { ...process.env, DATA_DIR: app.getPath("userData") },
  });
  worker.on("exit", () => {
    if (!quitting) setTimeout(startWorker, 10_000);
  });
}

function openDashboard() {
  if (win) {
    win.show();
    return;
  }
  win = new BrowserWindow({ width: 1200, height: 800 });
  win.loadURL(`http://127.0.0.1:${process.env.DASHBOARD_PORT || 3000}`);
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win?.hide();
    }
  });
}

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true });
  powerSaveBlocker.start("prevent-app-suspension");
  startWorker();

  const iconPath = path.join(__dirname, "../../assets/tray-icon.png");
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
    tray.setToolTip("Auto-Apply");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open dashboard", click: openDashboard },
        { label: "Pause applying", click: () => worker?.postMessage({ type: "pause" }) },
        { label: "Resume applying", click: () => worker?.postMessage({ type: "resume" }) },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            quitting = true;
            worker?.kill();
            app.quit();
          },
        },
      ])
    );
  } else {
    openDashboard();
  }
});

app.on("window-all-closed", () => {
  /* keep running in the tray */
});
