/**
 * Floating helper + optional autopilot fill.
 *
 * When autoFillEnabled is on (default), this detects job-application forms
 * and fills them from the saved resume/Q&A without requiring a click.
 * It never clicks Submit / Apply / Next — you still send the application.
 */
(function () {
  if (window.__resumeFitWidgetInjected) return;
  window.__resumeFitWidgetInjected = true;
  if (window.top !== window.self) return;

  chrome.storage.local.get(["widgetEnabled", "autoFillEnabled"], (res) => {
    const showWidget = res.widgetEnabled !== false;
    const autoFill = res.autoFillEnabled !== false; // default ON
    if (!showWidget && !autoFill) return;
    init({ showWidget, autoFill });
  });

  function countVisibleFields() {
    const fields = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );
    let visible = 0;
    fields.forEach((el) => {
      const s = window.getComputedStyle(el);
      if (!el.disabled && s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0") {
        visible++;
      }
    });
    return visible;
  }

  function looksLikeApplicationPage() {
    const href = location.href.toLowerCase();
    const host = location.hostname.toLowerCase();
    const strongAts =
      /greenhouse\.io|boards\.greenhouse|job-boards\.greenhouse|lever\.co|ashbyhq\.com|myworkdayjobs\.com|icims\.com|smartrecruiters\.com|jobvite\.com|taleo\.|successfactors|bamboohr\.com|dover\.io|gem\.com/.test(
        host
      ) || /\/(apply|application)(\/|$|\?)/.test(href);

    const softPath = /\/(jobs?|careers?|position|opening)\//.test(href) || /\b(careers|jobs)\./.test(host);
    const visible = countVisibleFields();
    const text = (document.body && document.body.innerText) || "";
    const copyHint = /apply for|submit application|upload (your )?resume|cover letter|work authorization|legally authorized/i.test(
      text.slice(0, 6000)
    );

    // Strong ATS/apply URL: fill as soon as any fields exist (even 1–2).
    if (strongAts && visible >= 1) return true;
    // Softer career pages: need a few fields + apply copy.
    if ((softPath || copyHint) && visible >= 2) return true;
    return visible >= 4 && copyHint;
  }

  function init({ showWidget, autoFill }) {
    let setStatus = () => {};
    let openPanel = () => {};

    if (showWidget) {
      const ui = buildWidgetUi();
      setStatus = ui.setStatus;
      openPanel = ui.openPanel;
      wireManualButtons(ui);
    }

    if (autoFill) {
      startAutopilotFill({ setStatus, openPanel, showWidget });
    }
  }

  function buildWidgetUi() {
    const root = document.createElement("div");
    root.id = "resume-fit-widget-root";
    root.style.cssText = "all:initial;";
    document.documentElement.appendChild(root);

    const shadow = root.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .bubble {
        position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px;
        border-radius: 50%; background: #4338ca; color: #fff; display: flex;
        align-items: center; justify-content: center; font-size: 18px; font-weight: 700;
        cursor: grab; box-shadow: 0 4px 14px rgba(0,0,0,0.3); z-index: 2147483647;
        user-select: none;
      }
      .bubble.working { background: #059669; }
      .bubble:active { cursor: grabbing; }
      .panel {
        position: fixed; bottom: 82px; right: 24px; width: 280px;
        background: #1a1a2e; color: #fff; border-radius: 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.35); z-index: 2147483647;
        padding: 12px; display: none; font-size: 12px; line-height: 1.5;
      }
      .panel.open { display: block; }
      .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .panel-header strong { font-size: 13px; }
      .close-btn { cursor: pointer; opacity: 0.7; font-size: 16px; background:none; border:none; color:#fff; }
      .row { display: flex; gap: 6px; margin-bottom: 6px; }
      button.action {
        flex: 1; background: #2d2d4d; color: #fff; border: none; border-radius: 6px;
        padding: 6px 4px; font-size: 11px; cursor: pointer;
      }
      button.action:hover { background: #3a3a63; }
      button.primary { background: #4338ca; }
      button.primary:hover { background: #3730a3; }
      .status { margin-top: 8px; opacity: 0.9; font-size: 11px; white-space: pre-line; }
      .hint { opacity: 0.65; font-size: 10px; margin-top: 6px; }
    `;
    shadow.appendChild(style);

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = "RF";
    bubble.title = "Resume-Fit — autopilot fill on (never auto-submits)";
    shadow.appendChild(bubble);

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="panel-header">
        <strong>Resume-Fit Autopilot</strong>
        <button class="close-btn" id="closeBtn">&times;</button>
      </div>
      <div class="hint">Autofill runs on its own when this looks like an application. It never clicks Submit.</div>
      <div class="row" style="margin-top:8px;">
        <button class="action" id="fillNameBtn">Fill Name</button>
        <button class="action" id="fillEmailBtn">Fill Email</button>
        <button class="action" id="fillPhoneBtn">Fill Phone</button>
      </div>
      <div class="row">
        <button class="action primary" id="fullAutofillBtn" style="flex:2;">Fill again now</button>
      </div>
      <div class="status" id="widgetStatus">Waiting for an application form…</div>
    `;
    shadow.appendChild(panel);

    let dragged = false;
    bubble.addEventListener("click", () => {
      if (dragged) {
        dragged = false;
        return;
      }
      panel.classList.toggle("open");
    });
    panel.querySelector("#closeBtn").addEventListener("click", () => panel.classList.remove("open"));
    makeDraggable(bubble, panel, () => {
      dragged = true;
    });

    return {
      bubble,
      panel,
      shadow,
      setStatus(text) {
        const el = panel.querySelector("#widgetStatus");
        if (el) el.innerHTML = text;
      },
      openPanel() {
        panel.classList.add("open");
      },
      markWorking(on) {
        bubble.classList.toggle("working", !!on);
        if (on) bubble.textContent = "…";
        else bubble.textContent = "RF";
      },
    };
  }

  function wireManualButtons(ui) {
    const { shadow, setStatus } = ui;
    async function getProfileAndQa() {
      const stored = await chrome.storage.local.get(["resumeProfile", "customAnswers"]);
      return {
        profile: stored.resumeProfile,
        qaItems: (stored.customAnswers || []).filter((qa) => qa && qa.question && qa.answer),
      };
    }

    shadow.querySelector("#fillNameBtn").addEventListener("click", async () => {
      const { profile } = await getProfileAndQa();
      if (!profile) return setStatus("Save your resume in the extension popup first.");
      const count =
        window.ResumeFitEngine.fillFieldType(profile, "name") +
        window.ResumeFitEngine.fillFieldType(profile, "firstName") +
        window.ResumeFitEngine.fillFieldType(profile, "lastName");
      setStatus(count > 0 ? `Filled ${count} name field(s).` : "No name field found.");
    });
    shadow.querySelector("#fillEmailBtn").addEventListener("click", async () => {
      const { profile } = await getProfileAndQa();
      if (!profile) return setStatus("Save your resume in the extension popup first.");
      const count = window.ResumeFitEngine.fillFieldType(profile, "email");
      setStatus(count > 0 ? `Filled ${count} email field(s).` : "No email field found.");
    });
    shadow.querySelector("#fillPhoneBtn").addEventListener("click", async () => {
      const { profile } = await getProfileAndQa();
      if (!profile) return setStatus("Save your resume in the extension popup first.");
      const count = window.ResumeFitEngine.fillFieldType(profile, "phone");
      setStatus(count > 0 ? `Filled ${count} phone field(s).` : "No phone field found.");
    });
    shadow.querySelector("#fullAutofillBtn").addEventListener("click", async () => {
      await runFillOnce({ setStatus, markWorking: ui.markWorking, force: true });
    });
  }

  function startAutopilotFill({ setStatus, openPanel, showWidget }) {
    let lastSig = "";
    let busy = false;

    const markWorking = showWidget
      ? (on) => {
          const root = document.getElementById("resume-fit-widget-root");
          const bubble = root && root.shadowRoot && root.shadowRoot.querySelector(".bubble");
          if (bubble) {
            bubble.classList.toggle("working", !!on);
            bubble.textContent = on ? "…" : "RF";
          }
        }
      : () => {};

    const tryFill = async (reason) => {
      if (busy) return;
      if (typeof window.ResumeFitEngine === "undefined") return;
      if (!looksLikeApplicationPage()) {
        if (reason === "manual") setStatus("No application form detected on this page yet.");
        return;
      }

      const sig = signatureForPage();
      if (sig === lastSig && reason !== "manual") return;

      busy = true;
      try {
        const did = await runFillOnce({ setStatus, markWorking, force: reason === "manual" });
        if (did) {
          lastSig = sig;
          if (showWidget) openPanel();
        }
      } finally {
        busy = false;
      }
    };

    // Run as soon as the script lands, then keep retrying while the ATS hydrates fields.
    const scheduleBurst = () => {
      tryFill("load");
      [50, 150, 300, 600, 1000, 1800, 3000, 5000, 8000, 12000].forEach((ms) =>
        setTimeout(() => tryFill("retry"), ms)
      );
    };
    scheduleBurst();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scheduleBurst(), { once: true });
    }
    window.addEventListener("load", () => scheduleBurst(), { once: true });

    // Multipage / SPA: new form fields appearing.
    const observer = new MutationObserver(() => {
      clearTimeout(observer._t);
      observer._t = setTimeout(() => tryFill("dom"), 200);
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "disabled"],
      });
    }

    // SPA URL changes (Greenhouse/Lever often don't full-reload).
    let lastHref = location.href;
    const onUrlMaybeChanged = () => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      lastSig = ""; // allow refill on the new step/page
      scheduleBurst();
    };
    window.addEventListener("popstate", onUrlMaybeChanged);
    ["pushState", "replaceState"].forEach((fn) => {
      const orig = history[fn];
      history[fn] = function () {
        const ret = orig.apply(this, arguments);
        queueMicrotask(onUrlMaybeChanged);
        return ret;
      };
    });
    setInterval(onUrlMaybeChanged, 800);

    // Background tab updates / "application opened" pings — fill immediately on open.
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "RESUME_FIT_PAGE_OPENED") {
        lastSig = "";
        scheduleBurst();
      }
    });
  }

  function signatureForPage() {
    const inputs = Array.from(
      document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
      )
    ).filter((el) => {
      const s = window.getComputedStyle(el);
      return !el.disabled && s.display !== "none" && s.visibility !== "hidden";
    });
    return location.pathname + "|" + inputs.length + "|" + inputs.map((el) => el.name || el.id || el.type).join(",");
  }

  async function runFillOnce({ setStatus, markWorking, force }) {
    const stored = await chrome.storage.local.get(["resumeProfile", "customAnswers", "autoFillEnabled"]);
    if (!force && stored.autoFillEnabled === false) return false;

    const profile = stored.resumeProfile;
    const qaItems = (stored.customAnswers || []).filter((qa) => qa && qa.question && qa.answer);
    if (!profile || (!profile.email && !profile.name && !profile.rawText)) {
      setStatus("Autopilot waiting: save your resume in the extension popup (Resume tab).");
      return false;
    }

    markWorking(true);
    try {
      const outcome = window.ResumeFitEngine.runFullAutofill(profile, qaItems);
      let text =
        `Autofilled without a click.\nFilled: ${outcome.filledCount} | Drafted: ${outcome.draftedCount} | Needs you: ${outcome.flaggedCount}`;
      if (outcome.match) text += `\nJob fit: ${outcome.match.score}%`;
      text += "\n\nYou still click Submit yourself.";
      setStatus(text);
      return outcome.filledCount + outcome.draftedCount > 0 || outcome.flaggedCount > 0;
    } catch (err) {
      setStatus("Autofill error: " + (err && err.message ? err.message : String(err)));
      return false;
    } finally {
      markWorking(false);
    }
  }

  function makeDraggable(handle, panel, onDragStart) {
    let startX, startY, startRight, startBottom;
    handle.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startY = e.clientY;
      const rect = handle.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();

      function onMouseMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) onDragStart();
        const newRight = Math.max(4, startRight - dx);
        const newBottom = Math.max(4, startBottom - dy);
        handle.style.right = `${newRight}px`;
        handle.style.bottom = `${newBottom}px`;
        panel.style.right = `${newRight}px`;
        panel.style.bottom = `${newBottom + 58}px`;
      }
      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
})();
