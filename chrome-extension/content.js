/**
 * Injected on-demand (only when the user clicks "Analyze & Fill This Page"
 * in the popup). It:
 *   1. Fills form fields it can confidently match using the user's OWN
 *      saved resume data — never invented content.
 *   2. Highlights fields it can't confidently map so the user fills them
 *      in themselves (checkboxes/radios about work authorization, free-text
 *      "why do you want this job" questions, etc. are always left to the
 *      human).
 *   3. Shows a job-fit score comparing the page's text to the resume.
 *
 * It never clicks Submit/Next/Apply and never simulates mouse movement.
 */
(async function resumeFitFill() {
  const existingPanel = document.getElementById("resume-fit-panel");
  if (existingPanel) existingPanel.remove();

  function sendResult(payload) {
    chrome.runtime.sendMessage({ type: "RESUME_FIT_RESULT", payload });
  }

  const stored = await chrome.storage.local.get(["resumeProfile"]);
  const profile = stored.resumeProfile;

  if (!profile || (!profile.email && !profile.name)) {
    sendResult({ error: "No resume profile saved yet. Go to the Resume tab in the extension popup first." });
    return;
  }

  const FIELD_PATTERNS = [
    { key: "email", tests: [/e-?mail/] },
    { key: "phone", tests: [/phone|mobile|cell/] },
    { key: "firstName", tests: [/first\s*name|given\s*name/] },
    { key: "lastName", tests: [/last\s*name|sur\s*name|family\s*name/] },
    { key: "name", tests: [/full\s*name|applicant\s*name|^name$|your\s*name/] },
    { key: "linkedin", tests: [/linkedin/] },
    { key: "website", tests: [/portfolio|github|personal\s*site|website/] },
    { key: "location", tests: [/^city$|location(?!.*(state|zip|code))/] },
    { key: "summary", tests: [/summary|about\s*you(?!.*why)/] },
  ];

  const NEVER_TOUCH_HINTS = [
    /cover\s*letter/,
    /why\s+(do\s+you|are\s+you)/,
    /sponsorship/,
    /authoriz/,
    /visa/,
    /disab/,
    /veteran/,
    /race|ethnic/,
    /gender/,
    /salary|compensation|pay\s*expect/,
    /notice\s*period/,
    /start\s*date|availab/,
  ];

  function labelForElement(el) {
    const parts = [];
    if (el.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (byFor) parts.push(byFor.textContent);
    }
    const wrappingLabel = el.closest("label");
    if (wrappingLabel) parts.push(wrappingLabel.textContent);
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node = document.getElementById(id);
        if (node) parts.push(node.textContent);
      });
    }
    if (el.placeholder) parts.push(el.placeholder);
    if (el.name) parts.push(el.name.replace(/[_-]/g, " "));
    if (el.id) parts.push(el.id.replace(/[_-]/g, " "));

    // Best-effort: text immediately preceding the field within the same container.
    const container = el.closest("div,li,tr,fieldset");
    if (container) {
      const textNode = Array.from(container.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0
      );
      if (textNode) parts.push(textNode.textContent);
      const prevSibling = container.previousElementSibling;
      if (prevSibling && /label|span|div|p/i.test(prevSibling.tagName)) {
        parts.push(prevSibling.textContent.slice(0, 80));
      }
    }

    return parts.join(" ").toLowerCase().trim();
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markFilled(el) {
    el.style.outline = "2px solid #10b981";
    el.style.outlineOffset = "1px";
    el.title = "Auto-filled from your saved resume profile";
  }

  function markFlagged(el, reason) {
    el.style.outline = "2px solid #f59e0b";
    el.style.outlineOffset = "1px";
    el.title = reason || "Resume-Fit couldn't confidently fill this — please complete it yourself";
  }

  function matchOptionValue(selectEl, desiredText) {
    const options = Array.from(selectEl.options);
    const lower = desiredText.toLowerCase();
    let best = options.find((o) => o.textContent.trim().toLowerCase() === lower);
    if (!best) best = options.find((o) => o.textContent.trim().toLowerCase().includes(lower));
    return best;
  }

  const candidateSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';
  const fields = Array.from(document.querySelectorAll(candidateSelector)).filter((el) => {
    const style = window.getComputedStyle(el);
    return !el.disabled && !el.readOnly && style.display !== "none" && style.visibility !== "hidden";
  });

  let filledCount = 0;
  let flaggedCount = 0;

  for (const el of fields) {
    const descriptor = labelForElement(el);
    const isCheckboxOrRadio = el.type === "checkbox" || el.type === "radio";

    if (isCheckboxOrRadio) {
      // Legally/factually sensitive yes-no questions must always be answered
      // by the human — we never guess these.
      markFlagged(el, "Please answer this yourself — Resume-Fit never guesses on checkboxes/radios");
      flaggedCount++;
      continue;
    }

    if (NEVER_TOUCH_HINTS.some((re) => re.test(descriptor))) {
      markFlagged(el, "This needs a genuine, personal answer — please fill it in yourself");
      flaggedCount++;
      continue;
    }

    const match = FIELD_PATTERNS.find((p) => p.tests.some((re) => re.test(descriptor)));
    if (!match) {
      // Only flag fields that look meaningful (skip empty descriptors, which
      // are usually layout artifacts, not real form questions).
      if (descriptor) {
        markFlagged(el, "Couldn't confidently match this field — please fill it in yourself");
        flaggedCount++;
      }
      continue;
    }

    let value = profile[match.key];
    if (match.key === "skills" && Array.isArray(value)) value = value.join(", ");
    if (!value) {
      markFlagged(el, `We don't have your "${match.key}" saved — please fill it in`);
      flaggedCount++;
      continue;
    }

    if (el.tagName === "SELECT") {
      const option = matchOptionValue(el, value);
      if (option) {
        el.value = option.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        markFilled(el);
        filledCount++;
      } else {
        markFlagged(el, "No matching dropdown option found — please select manually");
        flaggedCount++;
      }
      continue;
    }

    if (el.value && el.value.trim().length > 0) {
      // Don't overwrite something the user already typed.
      continue;
    }

    setNativeValue(el, value);
    markFilled(el);
    filledCount++;
  }

  // --- Job-fit scoring -------------------------------------------------
  const jobTextCandidates = [
    document.querySelector('[class*="job-description" i]'),
    document.querySelector('[class*="jobdescription" i]'),
    document.querySelector('[id*="job-description" i]'),
    document.querySelector("article"),
    document.querySelector("main"),
  ].filter(Boolean);

  const jobText = jobTextCandidates.length > 0 ? jobTextCandidates[0].innerText : document.body.innerText.slice(0, 8000);

  let match = null;
  if (typeof JobMatcher !== "undefined") {
    match = JobMatcher.computeMatchScore(profile.rawText || "", profile.skills || [], jobText);
  }

  // --- Floating summary panel ------------------------------------------
  const panel = document.createElement("div");
  panel.id = "resume-fit-panel";
  panel.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;background:#1a1a2e;color:#fff;" +
    "font-family:-apple-system,sans-serif;font-size:12px;padding:12px 14px;border-radius:10px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,0.3);max-width:260px;line-height:1.5;";
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <strong>Resume-Fit Assistant</strong>
      <span id="resume-fit-close" style="cursor:pointer;opacity:0.7;">&times;</span>
    </div>
    <div>✅ Filled: <strong>${filledCount}</strong></div>
    <div>⚠️ Needs your review: <strong>${flaggedCount}</strong></div>
    ${match ? `<div style="margin-top:6px;">Job fit score: <strong>${match.score}%</strong></div>` : ""}
    <div style="margin-top:6px;opacity:0.7;">Nothing was submitted. Review highlighted fields before applying.</div>
  `;
  document.body.appendChild(panel);
  document.getElementById("resume-fit-close").addEventListener("click", () => panel.remove());

  sendResult({ filledCount, flaggedCount, match });
})();
