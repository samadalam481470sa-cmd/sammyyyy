import { clickVisibleGoogleAccount } from "../../../../packages/core/src/dom";

function tick() {
  chrome.storage.local.get(["keepApplying"], (r) => {
    if (!r.keepApplying) return;
    clickVisibleGoogleAccount(document);
  });
}

tick();
window.setInterval(tick, 300);
const obs = new MutationObserver(() => tick());
obs.observe(document.documentElement, { childList: true, subtree: true });
