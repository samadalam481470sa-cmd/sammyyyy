chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "resume-fit-fill",
    title: "Fill this page with my resume",
    contexts: ["page", "editable"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "resume-fit-fill" && tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/matcher.js", "lib/tailor.js", "lib/autofillEngine.js", "content.js"],
    });
  }
});

function looksLikeApplyUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|icims\.com|smartrecruiters\.com|jobvite\.com|taleo\.|successfactors|bamboohr\.com|dover\.io|gem\.com/.test(
      u
    ) ||
    /\/(apply|application)(\/|$|\?)/.test(u) ||
    /\/(jobs?|careers?|position|opening)\//.test(u)
  );
}

/** Ping the page as soon as navigation lands on something that looks like an apply flow. */
function pingTab(tabId) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: "RESUME_FIT_PAGE_OPENED" }).catch(() => {
    // Content script may not be ready yet — inject the autopilot bundle.
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ["lib/matcher.js", "lib/tailor.js", "lib/autofillEngine.js", "widget.js"],
      })
      .then(() =>
        chrome.tabs.sendMessage(tabId, { type: "RESUME_FIT_PAGE_OPENED" }).catch(() => {})
      )
      .catch(() => {});
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Fire on URL change (SPA / redirect) and again when the document finishes loading.
  if (!changeInfo.url && changeInfo.status !== "loading" && changeInfo.status !== "complete") {
    return;
  }
  const url = changeInfo.url || (tab && tab.url);
  if (looksLikeApplyUrl(url)) pingTab(tabId);
});

if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    if (looksLikeApplyUrl(details.url)) pingTab(details.tabId);
  });
  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId !== 0) return;
    if (looksLikeApplyUrl(details.url)) pingTab(details.tabId);
  });
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;
    if (looksLikeApplyUrl(details.url)) pingTab(details.tabId);
  });
}
