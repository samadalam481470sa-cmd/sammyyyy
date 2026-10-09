import { clickVisibleGoogleAccount } from "../../../../packages/core/src/dom";

function tick() {
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying) return;
    if (clickVisibleGoogleAccount(document)) {
      chrome.storage.local.set({
        lastGoogleAccountAt: new Date().toISOString(),
        lastGoogleAccountUrl: location.href,
      });
      chrome.runtime
        .sendMessage({ type: "keep-status", status: "fill", url: location.href, detail: "google account" })
        .catch(() => {});
    }
  });
}

tick();
window.setInterval(tick, 160);
const obs = new MutationObserver(() => tick());
obs.observe(document.documentElement, { childList: true, subtree: true });
