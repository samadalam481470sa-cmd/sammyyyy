// Background service worker. Runs the on-demand autofill triggers (context menu
// + keyboard shortcut) and the scheduled job-discovery refresh.
importScripts("lib/matcher.js", "lib/jobFetcher.js");

const AUTOFILL_FILES = ["lib/matcher.js", "lib/tailor.js", "lib/autofillEngine.js", "content.js"];
const JOBS_ALARM = "refresh-jobs";
const REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // don't refetch more than every 6h automatically

function runAutofillOnTab(tabId) {
  if (!tabId) return;
  chrome.scripting.executeScript({ target: { tabId }, files: AUTOFILL_FILES }).catch(() => {
    // Restricted pages (chrome://, Web Store, etc.) can't be scripted — ignore.
  });
}

// --- Scheduled job discovery -------------------------------------------------

async function refreshJobs(force) {
  const stored = await chrome.storage.local.get(["resumeProfile", "jobZip", "lastJobRefresh"]);
  const last = stored.lastJobRefresh || 0;
  if (!force && Date.now() - last < REFRESH_MIN_INTERVAL_MS) {
    return { skipped: true };
  }
  const profile = stored.resumeProfile || {};
  const result = await self.JobFetcher.fetchAndRankJobs({
    zip: stored.jobZip || "",
    resumeText: profile.rawText || "",
    resumeSkills: profile.skills || [],
    max: 40,
  });
  await chrome.storage.local.set({ jobListings: result, lastJobRefresh: Date.now() });
  return { ok: true, result };
}

function ensureJobsAlarm() {
  chrome.alarms.get(JOBS_ALARM, (existing) => {
    if (!existing) {
      // First run soon, then roughly twice a day so a fresh batch is waiting.
      chrome.alarms.create(JOBS_ALARM, { delayInMinutes: 1, periodInMinutes: 720 });
    }
  });
}

function seedDefaults() {
  chrome.storage.local.get(["sensitiveDefaults"], (res) => {
    if (!res.sensitiveDefaults) {
      chrome.storage.local.set({
        sensitiveDefaults: {
          veteran: "I am not a protected veteran",
          disability: "No, I do not have a disability",
          gender: "",
          race: "",
        },
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "resume-fit-fill",
    title: "Fill this page with my resume",
    contexts: ["page", "editable"],
  });
  seedDefaults();
  ensureJobsAlarm();
  refreshJobs(true).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureJobsAlarm();
  // Every morning you open Chrome, make sure a fresh batch is ready.
  refreshJobs(false).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === JOBS_ALARM) refreshJobs(false).catch(() => {});
});

// --- On-demand autofill triggers --------------------------------------------

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "resume-fit-fill" && tab && tab.id) runAutofillOnTab(tab.id);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "full-autofill") return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) runAutofillOnTab(tab.id);
  });
});

// --- Popup <-> background messaging ------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === "REFRESH_JOBS") {
    refreshJobs(true)
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep the message channel open for the async response
  }
  if (message.type === "GET_JOBS") {
    chrome.storage.local.get(["jobListings"], (res) => sendResponse(res.jobListings || null));
    return true;
  }
});
