// Files injected to run a full autofill pass on demand. Kept in one place so
// the context menu, the keyboard shortcut, and the popup all stay in sync.
const AUTOFILL_FILES = ["lib/matcher.js", "lib/tailor.js", "lib/autofillEngine.js", "content.js"];

function runAutofillOnTab(tabId) {
  if (!tabId) return;
  chrome.scripting
    .executeScript({ target: { tabId }, files: AUTOFILL_FILES })
    .catch(() => {
      // Restricted pages (chrome://, the Web Store, etc.) can't be scripted;
      // failing quietly is fine — nothing to fill there anyway.
    });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "resume-fit-fill",
    title: "Fill this page with my resume",
    contexts: ["page", "editable"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "resume-fit-fill" && tab && tab.id) {
    runAutofillOnTab(tab.id);
  }
});

// Keyboard shortcut (default Alt+Shift+F): fill the active page instantly,
// without needing to open the popup or the floating widget first.
chrome.commands.onCommand.addListener((command) => {
  if (command !== "full-autofill") return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) runAutofillOnTab(tab.id);
  });
});
