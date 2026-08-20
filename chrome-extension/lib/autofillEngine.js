/**
 * Shared autofill engine used by both:
 *   - content.js (triggered on-demand from the popup's "Analyze & Fill" button)
 *   - widget.js (the always-available floating on-page helper)
 *
 * Design rules (do not violate these when extending):
 *   - Only ever fill fields with the user's OWN saved data (resume profile
 *     or their own typed Q&A answers) — never invented facts.
 *   - Legally/factually sensitive questions (work authorization, visa,
 *     salary, disability, veteran status, etc.) are only filled from an
 *     exact user-provided Q&A answer — otherwise they're flagged for the
 *     human, never guessed.
 *   - Open-ended narrative fields may get a *draft* suggestion built only
 *     from the user's real resume content, always visually marked as a
 *     draft that needs review — never treated as final.
 *   - Never click Submit/Next/Apply. Never simulate mouse movement or any
 *     other bot-detection evasion.
 */
(function (global) {
  // Order matters: the first pattern whose regex matches the field's descriptor
  // wins, so more specific keys must come before more general ones. Word
  // boundaries (\b) keep short keys like "state"/"city" from matching inside
  // unrelated words (e.g. "united states", "statement").
  const FIELD_PATTERNS = [
    { key: "email", tests: [/e-?mail/] },
    { key: "phone", tests: [/phone|mobile|\bcell\b|contact\s*number/] },
    { key: "firstName", tests: [/first\s*name|given\s*name|forename/] },
    { key: "lastName", tests: [/last\s*name|sur\s*name|family\s*name/] },
    { key: "name", tests: [/full\s*name|applicant\s*name|^name$|your\s*name|legal\s*name|preferred\s*name/] },
    { key: "linkedin", tests: [/linkedin/] },
    { key: "github", tests: [/git\s*hub/] },
    { key: "website", tests: [/portfolio|personal\s*(web)?\s*site|\bwebsite\b|personal\s*url/] },
    { key: "zip", tests: [/\bzip\b|zipcode|postal\s*code|post\s*code/] },
    { key: "state", tests: [/\bstate\b|\bprovince\b|state\s*\/\s*province/] },
    { key: "city", tests: [/\bcity\b|\btown\b|city\s*\/\s*town|municipality/] },
    { key: "address", tests: [/street\s*address|address\s*line|\bstreet\b|mailing\s*address|home\s*address|residential\s*address|\baddress\b/] },
    { key: "location", tests: [/\blocation\b(?!.*(state|zip|code))|current\s*location/] },
    { key: "currentTitle", tests: [/current\s*(job\s*)?(title|role|position)|present\s*(title|role|position)|most\s*recent\s*(title|role|position)|current\s*job/] },
    { key: "currentCompany", tests: [/current\s*(employer|company|organization|organisation|workplace)|present\s*(employer|company)|most\s*recent\s*(employer|company)/] },
    { key: "school", tests: [/\bschool\b|university|college|institution|alma\s*mater/] },
    { key: "degree", tests: [/\bdegree\b|qualification|\bmajor\b|field\s*of\s*study|area\s*of\s*study/] },
    { key: "gradYear", tests: [/graduation|grad\s*year|year\s*of\s*graduation|expected\s*graduation|completion\s*(year|date)/] },
    { key: "yearsExperience", tests: [/years\s*of\s*experience|years'?\s*experience|total\s*(years\s*)?experience|experience\s*in\s*years/] },
    { key: "summary", tests: [/summary|about\s*you(?!.*why)|professional\s*summary|profile\s*summary/] },
  ];

  // Profile keys the "Fill contact info" quick action populates in one click.
  const CONTACT_KEYS = ["name", "firstName", "lastName", "email", "phone", "location", "city", "state", "zip", "address", "linkedin", "github", "website"];

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

  // Legally sensitive self-identification questions the user can pre-answer once
  // (in the popup's Settings) so they're filled automatically instead of flagged.
  // Only ever filled from the user's own chosen default — never guessed.
  const EEO_RULES = [
    { key: "veteran", tests: [/veteran|protected\s*veteran|military\s*status/] },
    { key: "disability", tests: [/disab/] },
    { key: "gender", tests: [/\bgender\b|\bsex\b(?!ual\s*orientation)/] },
    { key: "race", tests: [/race|ethnic|hispanic|latino/] },
  ];

  // Built-in defaults for the two the user asked to standardize. The popup lets
  // the user review/change/disable these; callers pass whatever is stored.
  const DEFAULT_EEO = {
    veteran: "I am not a protected veteran",
    disability: "No, I do not have a disability",
    gender: "",
    race: "",
  };

  const NARRATIVE_HINTS = [
    /cover\s*letter/,
    /why\s+(do|are|should)\s+you/,
    /why\s+(this|our|the)\s+(company|role|team|position|job)/,
    /tell\s+us\s+about\s+yourself/,
    /about\s*you(?!.*(email|address))/,
    /additional\s+(information|comments|details)/,
    /greatest\s+(strength|weakness|accomplishment|achievement)/,
    /(describe|tell\s+me\s+about)\s+a\s+time/,
    /what\s+(makes|motivates|drives|excites)\s+you/,
    /career\s+(goal|aspiration|objective)/,
    /interest(ed)?\s+in\s+(this|the|our)\s+(role|position|company|team)/,
    /why\s+should\s+we\s+hire/,
    /biggest\s+challenge/,
    /proud(est)?\s+of/,
    /describe\s+yourself/,
    /anything\s+else|note\s+to\s+the\s+hiring|message\s+to\s+the\s+hiring/,
    /qualif(ies|y|ied)\s+you|good\s+fit/,
  ];

  // Technical / experience prompts: drafted from the candidate's real skills and
  // resume bullets, with a generic professional fallback the user personalizes.
  const TECHNICAL_HINTS = [
    /experience\s+(with|in|using)/,
    /describe\s+your\s+(experience|background)/,
    /what\s+(technolog|tools|languages|frameworks|stack|skills)/,
    /proficien(t|cy)\s+(in|with)/,
    /familiar(ity)?\s+with/,
    /technical\s+(skills|background|experience|expertise)/,
    /relevant\s+(experience|skills|projects)/,
    /how\s+(have|do)\s+you\s+use/,
    /walk\s+us\s+through\s+a\s+project/,
    /projects?\s+(you'?ve|have\s+you)\s+(worked|built)/,
  ];

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
    return bestScore >= 0.6 ? best : null;
  }

  function joinList(items) {
    const a = items.filter(Boolean);
    if (a.length === 0) return "";
    if (a.length === 1) return a[0];
    if (a.length === 2) return `${a[0]} and ${a[1]}`;
    return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
  }

  function firstResumeLine(profile) {
    const bullet = (profile.bullets || []).find((b) => b && b.trim().length > 0);
    if (bullet) return bullet.trim().replace(/^[-•*\u2022\u25cf]+\s*/, "");
    if (profile.experience) {
      const line = profile.experience.split("\n").find((l) => l.trim().length > 0);
      if (line) return line.trim().replace(/^[-•*\u2022\u25cf]+\s*/, "");
    }
    return "";
  }

  // Behavioral / "filler" prompts (why this role, tell us about yourself, greatest
  // strength, etc.). Built from the user's real resume; falls back to generic
  // professional phrasing the user then personalizes. Always returned as a DRAFT.
  function draftNarrativeAnswer(profile) {
    const parts = [];
    const topSkills = (profile.skills || []).slice(0, 5);
    const role = profile.currentTitle || "professional";

    if (profile.summary) {
      parts.push(profile.summary);
    } else if (topSkills.length) {
      parts.push(`I'm a ${role} with hands-on experience in ${joinList(topSkills.slice(0, 4))}.`);
    } else {
      parts.push(`I'm a motivated ${role} who takes ownership, communicates clearly, and learns quickly.`);
    }

    const recent = firstResumeLine(profile);
    if (recent) {
      const lead = recent.charAt(0).toLowerCase() + recent.slice(1);
      parts.push(`For example, I ${lead}`.replace(/\.?$/, "."));
    }

    if (profile.school || profile.degree) {
      parts.push(`My background${profile.degree ? ` in ${profile.degree}` : ""}${profile.school ? ` at ${profile.school}` : ""} gives me a solid foundation for this role.`);
    }

    parts.push("I'm excited about this opportunity and would bring strong work ethic, reliability, and a collaborative attitude to your team.");
    return parts.join(" ");
  }

  // Technical / experience prompts. Highlights the candidate's real skills that
  // appear in the page's job description, with a generic fallback.
  function draftTechnicalAnswer(profile, jobText) {
    const skills = profile.skills || [];
    const jt = (jobText || "").toLowerCase();
    const relevant = skills.filter((s) => s && jt.includes(s.toLowerCase())).slice(0, 6);
    const parts = [];

    if (relevant.length) {
      parts.push(`I have hands-on experience with ${joinList(relevant)}.`);
    } else if (skills.length) {
      parts.push(`I have hands-on experience with ${joinList(skills.slice(0, 5))}.`);
    } else {
      parts.push("I have practical, hands-on experience with the core tools and technologies this role uses.");
    }

    const recent = firstResumeLine(profile);
    if (recent) {
      const lead = recent.charAt(0).toLowerCase() + recent.slice(1);
      parts.push(`Most recently, I ${lead}`.replace(/\.?$/, "."));
    }

    parts.push("I'm comfortable picking up new technologies quickly and applying them to real problems.");
    return parts.join(" ");
  }

  function isNegativeAnswer(answer) {
    return /^\s*(no\b|not\b|none\b|n\/a\b)/i.test(answer) || /\bdo(n'?t| not)\b|not a\b|no,\s/i.test(answer);
  }

  function isAffirmativeAnswer(answer) {
    return /^\s*(yes\b|i (am|do|identify)|agree)/i.test(answer);
  }

  // Chooses the option (radio label or <option>) that best represents `answer`,
  // with sensible yes/no fallbacks for self-identification questions.
  function pickOptionForAnswer(options, answer) {
    const lower = (answer || "").toLowerCase().trim();
    if (!lower) return null;
    let best = options.find((o) => o.text === lower);
    if (best) return best;
    best = options.find((o) => o.text && (o.text.includes(lower) || lower.includes(o.text)));
    if (best) return best;
    if (isNegativeAnswer(answer)) {
      best = options.find((o) => /^no\b|^no,|\bnot\b|do\s*n'?t|decline\s+to/.test(o.text));
      if (best) return best;
    }
    if (isAffirmativeAnswer(answer)) {
      best = options.find((o) => /^yes\b|\bi\s+(am|do|identify)\b/.test(o.text));
      if (best) return best;
    }
    return null;
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

  function extractJobText() {
    const candidates = [
      document.querySelector('[class*="job-description" i]'),
      document.querySelector('[class*="jobdescription" i]'),
      document.querySelector('[id*="job-description" i]'),
      document.querySelector("article"),
      document.querySelector("main"),
    ].filter(Boolean);
    return candidates.length > 0 ? candidates[0].innerText : document.body.innerText.slice(0, 8000);
  }

  // Fills a single sensitive/EEO field (text, select, or checkbox) from a saved
  // default answer. Returns true if it filled the field.
  function fillFromDefault(el, answer) {
    if (!answer) return false;
    if (el.type === "checkbox") {
      el.checked = isAffirmativeAnswer(answer);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (el.tagName === "SELECT") {
      const options = Array.from(el.options).map((o) => ({ el: o, text: o.textContent.trim().toLowerCase() }));
      const picked = pickOptionForAnswer(options, answer);
      if (!picked) return false;
      el.value = picked.el.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    setNativeValue(el, answer);
    return true;
  }

  /**
   * Runs the full page autofill pass. Returns { filledCount, draftedCount, flaggedCount, match, tailor }.
   * `defaults` holds the user's pre-answered self-identification answers
   * (veteran/disability/etc.); pass DEFAULT_EEO to use the built-ins.
   */
  function runFullAutofill(profile, qaItems, defaults) {
    let filledCount = 0;
    let draftedCount = 0;
    let flaggedCount = 0;
    const eeoDefaults = defaults || DEFAULT_EEO;
    const jobText = extractJobText();

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
      const customAnswer = findCustomAnswer(groupDescriptor, qaItems);
      if (customAnswer) {
        const target = group.find((radio) => {
          const optionLabel = labelForElement(radio);
          return optionLabel.includes(customAnswer.answer.toLowerCase()) || customAnswer.answer.toLowerCase().includes(optionLabel);
        });
        if (target) {
          target.checked = true;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          group.forEach((r) => markFilled(r, `Set from your saved answer: "${groupDescriptor}" -> ${customAnswer.answer}`));
          filledCount++;
          continue;
        }
      }
      // Pre-answered self-identification (veteran/disability/etc.) from settings.
      const eeoRule = EEO_RULES.find((r) => r.tests.some((re) => re.test(groupDescriptor)));
      if (eeoRule && eeoDefaults[eeoRule.key]) {
        const options = group.map((el) => ({ el, text: labelForElement(el) }));
        const picked = pickOptionForAnswer(options, eeoDefaults[eeoRule.key]);
        if (picked) {
          picked.el.checked = true;
          picked.el.dispatchEvent(new Event("change", { bubbles: true }));
          group.forEach((r) => markFilled(r, `Set from your saved default: ${eeoDefaults[eeoRule.key]}`));
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
      const isTextArea = el.tagName === "TEXTAREA";

      const customAnswer = findCustomAnswer(descriptor, qaItems);
      if (customAnswer) {
        if (isCheckbox) {
          const affirmative = /^(yes|true|agree|checked|confirm)/i.test(customAnswer.answer.trim());
          el.checked = affirmative;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          markFilled(el, `Set from your saved answer: "${customAnswer.question}" -> ${customAnswer.answer}`);
          filledCount++;
          continue;
        }
        if (el.tagName === "SELECT") {
          const option = matchOptionValue(el, customAnswer.answer);
          if (option) {
            el.value = option.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            markFilled(el, `Set from your saved answer: "${customAnswer.question}"`);
            filledCount++;
            continue;
          }
        } else {
          setNativeValue(el, customAnswer.answer);
          markFilled(el, `Filled from your saved answer: "${customAnswer.question}"`);
          filledCount++;
          continue;
        }
      }

      // Pre-answered self-identification defaults (veteran / disability / etc.).
      const eeoRule = EEO_RULES.find((r) => r.tests.some((re) => re.test(descriptor)));
      if (eeoRule && eeoDefaults[eeoRule.key]) {
        if (fillFromDefault(el, eeoDefaults[eeoRule.key])) {
          markFilled(el, `Set from your saved default: ${eeoDefaults[eeoRule.key]}`);
          filledCount++;
          continue;
        }
      }

      if (isCheckbox) {
        markFlagged(el, "Please answer this yourself, or save an answer for it in the Q&A tab");
        flaggedCount++;
        continue;
      }

      // Long-form drafting (behavioral + technical) — only for textareas so we
      // never dump a paragraph into a short single-line input.
      if (isTextArea && (!el.value || !el.value.trim())) {
        if (NARRATIVE_HINTS.some((re) => re.test(descriptor))) {
          setNativeValue(el, draftNarrativeAnswer(profile));
          markDraft(el);
          draftedCount++;
          continue;
        }
        if (TECHNICAL_HINTS.some((re) => re.test(descriptor))) {
          setNativeValue(el, draftTechnicalAnswer(profile, jobText));
          markDraft(el);
          draftedCount++;
          continue;
        }
      }

      if (SENSITIVE_HINTS.some((re) => re.test(descriptor))) {
        markFlagged(el, "Set a default in Settings, save a Q&A answer, or fill it in yourself");
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

  /**
   * Fills every common contact field in one pass (name, email, phone, city,
   * state, zip, address, linkedin, etc.). Returns the number of fields filled.
   */
  function fillContact(profile) {
    if (!profile) return 0;
    let count = 0;
    for (const key of CONTACT_KEYS) {
      count += fillFieldType(profile, key);
    }
    return count;
  }

  global.ResumeFitEngine = {
    runFullAutofill,
    fillFieldType,
    fillContact,
    DEFAULT_EEO,
  };
})(typeof window !== "undefined" ? window : globalThis);
