/**
 * Shared autofill engine used by both:
 *   - content.js (triggered on-demand from the popup's "Analyze & Fill" button)
 *   - widget.js (the always-available floating on-page helper)
 *
 * Design rules (do not violate these when extending):
 *   - Run on its own from the resume/profile and saved answers. Do not wait
 *     for a human on every field. Fillglen Autofill & keep applying is the
 *     24/7 Chrome widget: after Start it fills, clicks the application
 *     screen, submits, and moves on. It does not invent a name, email, or
 *     work history.
 *   - Legally/factually sensitive questions (work authorization, visa,
 *     salary, disability, veteran status, etc.) are only filled from an
 *     exact user-provided Q&A answer — otherwise they're flagged for the
 *     human, never guessed.
 *   - Open-ended narrative fields may get a *draft* suggestion built only
 *     from the user's real resume content, always visually marked as a
 *     draft that needs review — never treated as final.
 *   - This older helper does not click Submit. Fillglen keep-applying does,
 *     after Start. If a page looks like it detected automation, Fillglen
 *     slows down and keeps going. It never solves CAPTCHAs.
 */
(function (global) {
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
    { key: "address", tests: [/street|address line|mailing address/] },
    { key: "city", tests: [/^city$|town\/city/] },
    { key: "state", tests: [/state|province|region/] },
    { key: "zip", tests: [/zip|postal/] },
    { key: "country", tests: [/country|nation/] },
  ];

  const SENSITIVE_HINTS = [
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
    /how\s+did\s+you\s+hear/,
    /relocat/,
  ];

  const NARRATIVE_HINTS = [/cover\s*letter/, /why\s+(do\s+you|are\s+you)/, /tell\s+us\s+about\s+yourself/, /additional\s+information/];

  function normalizeText(text) {
    return (text || "").toLowerCase().trim();
  }

  function tokenize(text) {
    if (typeof global.JobMatcher !== "undefined") return global.JobMatcher.tokenize(text);
    return normalizeText(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  function findCustomAnswer(descriptor, qaItems) {
    if (!descriptor || !qaItems || qaItems.length === 0) return null;
    const descTokens = new Set(tokenize(descriptor));
    if (descTokens.size === 0) return null;
    let best = null;
    let bestScore = 0;
    for (const qa of qaItems) {
      const qTokens = tokenize(qa.question);
      if (qTokens.length === 0) continue;
      const overlap = qTokens.filter((t) => descTokens.has(t)).length;
      const score = overlap / qTokens.length;
      if (score > bestScore) {
        bestScore = score;
        best = qa;
      }
    }
    return bestScore >= 0.45 ? best : null;
  }

  function consentLooksChecked(descriptor) {
    return /terms|privacy|consent|i agree|i have read|i accept/.test(descriptor);
  }

  function derivedProfileAnswer(descriptor, profile, qaItems) {
    const custom = findCustomAnswer(descriptor, qaItems);
    if (custom) return custom.answer;
    if (/how\s+did\s+you\s+hear|where\s+did\s+you\s+hear|referral source/.test(descriptor)) {
      return "Company website";
    }
    if (/authoriz|eligible to work|legally authorized/.test(descriptor)) {
      const saved = findCustomAnswer("authorized to work", qaItems) || findCustomAnswer("work authorization", qaItems);
      if (saved) return saved.answer;
    }
    if (/sponsorship|visa/.test(descriptor)) {
      const saved = findCustomAnswer("sponsorship", qaItems) || findCustomAnswer("visa", qaItems);
      if (saved) return saved.answer;
    }
    if (/relocat/.test(descriptor)) {
      const saved = findCustomAnswer("relocate", qaItems);
      if (saved) return saved.answer;
    }
    if (/salary|compensation|pay\s*expect/.test(descriptor) && profile.salary) return String(profile.salary);
    if (/start\s*date|availab|notice\s*period/.test(descriptor) && (profile.startDate || profile.noticePeriod)) {
      return String(profile.startDate || profile.noticePeriod);
    }
    if (/country|nation/.test(descriptor) && (profile.country || /united states|usa|dallas|tx|texas/i.test(profile.location || ""))) {
      return profile.country || "United States";
    }
    return null;
  }

  function applyAnswerToField(el, value, reason) {
    if (el.type === "checkbox") {
      const affirmative = /^(yes|true|agree|checked|confirm|on|1)/i.test(String(value).trim()) || consentLooksChecked(labelForElement(el));
      el.checked = affirmative;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      markFilled(el, reason);
      return true;
    }
    if (el.tagName === "SELECT") {
      const option = matchOptionValue(el, value);
      if (!option) return false;
      el.value = option.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      markFilled(el, reason);
      return true;
    }
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      markFilled(el, reason);
      return true;
    }
    setNativeValue(el, value);
    markFilled(el, reason);
    return true;
  }

  function draftNarrativeAnswer(profile) {
    const parts = [];
    const topSkills = (profile.skills || []).slice(0, 4).join(", ");
    if (profile.summary) {
      parts.push(profile.summary);
    } else if (topSkills) {
      parts.push(`I'm a professional with hands-on experience in ${topSkills}.`);
    }
    if (profile.experience) {
      const firstLine = profile.experience.split("\n").find((l) => l.trim().length > 0);
      if (firstLine) parts.push(`Most recently: ${firstLine.trim()}.`);
    }
    if (parts.length === 0) return "";
    parts.push("I'd welcome the opportunity to bring this experience to your team.");
    return parts.join(" ");
  }

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

    return normalizeText(parts.join(" "));
  }

  function describeRadioGroup(radios) {
    const first = radios[0];
    const fieldset = first.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.textContent.trim()) return normalizeText(legend.textContent);
    }
    const container = first.closest("div,li,tr");
    if (container && container.parentElement) {
      const heading = Array.from(container.parentElement.children).find(
        (c) => c !== container && c.textContent.trim().length > 0 && !c.querySelector("input,select,textarea")
      );
      if (heading) return normalizeText(heading.textContent.slice(0, 120));
    }
    return normalizeText(first.getAttribute("aria-label") || first.name || "");
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

  function markFilled(el, reason) {
    el.style.outline = "2px solid #10b981";
    el.style.outlineOffset = "1px";
    el.title = reason || "Auto-filled from your saved resume profile";
  }

  function markDraft(el) {
    el.style.outline = "2px solid #3b82f6";
    el.style.outlineOffset = "1px";
    el.title = "Drafted from your resume — please review & personalize before submitting";
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

  function getVisibleFields() {
    const candidateSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';
    return Array.from(document.querySelectorAll(candidateSelector)).filter((el) => {
      const style = window.getComputedStyle(el);
      return !el.disabled && !el.readOnly && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  /**
   * Runs the full page autofill pass. Returns { filledCount, draftedCount, flaggedCount, match }.
   */
  function runFullAutofill(profile, qaItems) {
    let filledCount = 0;
    let draftedCount = 0;
    let flaggedCount = 0;

    const allFields = getVisibleFields();

    const radios = allFields.filter((el) => el.type === "radio");
    const radioGroups = new Map();
    radios.forEach((el) => {
      const key = (el.name || el.id || "unnamed") + "::" + (el.getAttribute("form") || "");
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key).push(el);
    });

    for (const group of radioGroups.values()) {
      const groupDescriptor = describeRadioGroup(group);
      const answer = derivedProfileAnswer(groupDescriptor, profile, qaItems);
      if (answer) {
        const target = group.find((radio) => {
          const optionLabel = labelForElement(radio);
          const a = String(answer).toLowerCase();
          return optionLabel.includes(a) || a.includes(optionLabel) || optionLabel === a;
        });
        if (target) {
          target.checked = true;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          group.forEach((r) => markFilled(r, `Set from your saved resume/Q&A: "${groupDescriptor}" -> ${answer}`));
          filledCount++;
          continue;
        }
      }
      group.forEach((r) => markFlagged(r, "Please answer this yourself, or save an answer for it in the Q&A tab"));
      flaggedCount++;
    }

    const fields = allFields.filter((el) => el.type !== "radio");

    for (const el of fields) {
      const descriptor = labelForElement(el);
      const isCheckbox = el.type === "checkbox";

      const derived = derivedProfileAnswer(descriptor, profile, qaItems);
      if (derived) {
        if (applyAnswerToField(el, derived, `Filled from your saved resume/Q&A`)) {
          filledCount++;
          continue;
        }
      }

      if (isCheckbox) {
        if (consentLooksChecked(descriptor)) {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          markFilled(el, "Checked from the consent/terms wording on your application");
          filledCount++;
          continue;
        }
        markFlagged(el, "Please answer this yourself, or save an answer for it in the Q&A tab");
        flaggedCount++;
        continue;
      }

      if (NARRATIVE_HINTS.some((re) => re.test(descriptor))) {
        const draft = draftNarrativeAnswer(profile);
        if (draft && (!el.value || !el.value.trim())) {
          setNativeValue(el, draft);
          markDraft(el);
          draftedCount++;
        } else if (!el.value || !el.value.trim()) {
          markFlagged(el, "Add a summary/skills in the Resume tab so we can draft this, or write your own");
          flaggedCount++;
        }
        continue;
      }

      if (SENSITIVE_HINTS.some((re) => re.test(descriptor))) {
        const again = derivedProfileAnswer(descriptor, profile, qaItems);
        if (again && applyAnswerToField(el, again, "Filled from your saved resume/Q&A")) {
          filledCount++;
          continue;
        }
        markFlagged(el, "Save an answer for this in the Q&A tab, or fill it in yourself");
        flaggedCount++;
        continue;
      }

      const match = FIELD_PATTERNS.find((p) => p.tests.some((re) => re.test(descriptor)));
      if (!match) {
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
        continue;
      }

      setNativeValue(el, value);
      markFilled(el);
      filledCount++;
    }

    const jobTextCandidates = [
      document.querySelector('[class*="job-description" i]'),
      document.querySelector('[class*="jobdescription" i]'),
      document.querySelector('[id*="job-description" i]'),
      document.querySelector("article"),
      document.querySelector("main"),
    ].filter(Boolean);

    const jobText = jobTextCandidates.length > 0 ? jobTextCandidates[0].innerText : document.body.innerText.slice(0, 8000);

    let match = null;
    if (typeof global.JobMatcher !== "undefined") {
      match = global.JobMatcher.computeMatchScore(profile.rawText || "", profile.skills || [], jobText);
    }

    // Per-role tailoring advice: which of the candidate's real skills and
    // bullets to lead with for this specific posting.
    let tailor = null;
    if (typeof global.ResumeFitTailor !== "undefined") {
      tailor = global.ResumeFitTailor.tailorForRole(profile, jobText, { bulletLimit: 4, gapLimit: 8 });
    }

    return { filledCount, draftedCount, flaggedCount, match, tailor };
  }

  /**
   * Fills every visible field matching a single profile key (e.g. "name",
   * "email", "phone"). Used by the floating widget's one-click buttons.
   * Returns the number of fields filled.
   */
  function fillFieldType(profile, key) {
    const patternEntry = FIELD_PATTERNS.find((p) => p.key === key);
    if (!patternEntry) return 0;
    let value = profile[key];
    if (key === "skills" && Array.isArray(value)) value = value.join(", ");
    if (!value) return 0;

    let count = 0;
    for (const el of getVisibleFields()) {
      if (el.type === "radio" || el.type === "checkbox") continue;
      const descriptor = labelForElement(el);
      if (!patternEntry.tests.some((re) => re.test(descriptor))) continue;
      if (el.value && el.value.trim().length > 0) continue;

      if (el.tagName === "SELECT") {
        const option = matchOptionValue(el, value);
        if (option) {
          el.value = option.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          markFilled(el);
          count++;
        }
        continue;
      }

      setNativeValue(el, value);
      markFilled(el);
      count++;
    }
    return count;
  }

  global.ResumeFitEngine = {
    runFullAutofill,
    fillFieldType,
  };
})(typeof window !== "undefined" ? window : globalThis);
