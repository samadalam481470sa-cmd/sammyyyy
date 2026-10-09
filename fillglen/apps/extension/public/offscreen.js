setInterval(() => {
  chrome.runtime.sendMessage({ type: "keep-heartbeat" }).catch(() => {});
}, 500);
