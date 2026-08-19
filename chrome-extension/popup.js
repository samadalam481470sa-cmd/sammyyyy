const STORAGE_KEY = "resumeProfile";
const QA_STORAGE_KEY = "customAnswers";

const QUICK_ADD_QUESTIONS = [
  "Are you legally authorized to work in this country?",
  "Will you now or in the future require visa sponsorship?",
  "What are your salary expectations?",
  "What is your notice period / earliest start date?",
  "How did you hear about this position?",
  "Are you willing to relocate?",
  "Are you comfortable with on-site / hybrid / remote work?",
  "Do you have a disability?",
  "Veteran status",
  "What is your preferred work location?",
  "Gender",
  "Race / ethnicity",
  "Pronouns",
  "Are you at least 18 years of age?",
  "Have you previously worked for this company?",
  "Are you currently employed?",
  "Why do you want to work here?",
  "Why are you a good fit for this role?",
  "Tell us about yourself",
  "What are your greatest strengths?",
  "Expected graduation date",
  "GPA",
  "Are you willing to travel?",
  "Do you have reliable transportation?",
  "Have you ever been convicted of a crime?",
  "Were you referred by a current employee? If so, who?",
  "What is your desired job title?",
  "When are you available to start?",
  "Do you have any scheduling restrictions?",
  "Preferred name",
];

const els = {
  tabs: document.querySelectorAll(".tab-btn"),
  panels: document.querySelectorAll(".tab-panel"),
  resumeFile: document.getElementById("resumeFile"),
  resumePaste: document.getElementById("resumePaste"),
  parseBtn: document.getElementById("parseBtn"),
  saveBtn: document.getElementById("saveBtn"),
  saveStatus: document.getElementById("saveStatus"),
  fillBtn: document.getElementById("fillBtn"),
  fillResult: document.getElementById("fillResult"),
  widgetToggle: document.getElementById("widgetToggle"),
  qaList: document.getElementById("qaList"),
  addQaBtn: document.getElementById("addQaBtn"),
  qaQuickAdd: document.getElementById("qaQuickAdd"),
  saveQaBtn: document.getElementById("saveQaBtn"),
  qaSaveStatus: document.getElementById("qaSaveStatus"),
  defVeteran: document.getElementById("defVeteran"),
  defDisability: document.getElementById("defDisability"),
  defGender: document.getElementById("defGender"),
  defRace: document.getElementById("defRace"),
  defStatus: document.getElementById("defStatus"),
  jobZip: document.getElementById("jobZip"),
  refreshJobsBtn: document.getElementById("refreshJobsBtn"),
  jobsStatus: document.getElementById("jobsStatus"),
  jobsList: document.getElementById("jobsList"),
  name: document.getElementById("fName"),
  firstName: document.getElementById("fFirstName"),
  lastName: document.getElementById("fLastName"),
  email: document.getElementById("fEmail"),
  phone: document.getElementById("fPhone"),
  location: document.getElementById("fLocation"),
  city: document.getElementById("fCity"),
  state: document.getElementById("fState"),
  zip: document.getElementById("fZip"),
  address: document.getElementById("fAddress"),
  linkedin: document.getElementById("fLinkedin"),
  github: document.getElementById("fGithub"),
  website: document.getElementById("fWebsite"),
  currentTitle: document.getElementById("fCurrentTitle"),
  currentCompany: document.getElementById("fCurrentCompany"),
  school: document.getElementById("fSchool"),
  degree: document.getElementById("fDegree"),
  gradYear: document.getElementById("fGradYear"),
  yearsExperience: document.getElementById("fYears"),
  skills: document.getElementById("fSkills"),
  summary: document.getElementById("fSummary"),
};

let rawResumeText = "";

function switchTab(tabName) {
  els.tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
}

els.tabs.forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

function populateFieldsFromProfile(profile) {
  els.name.value = profile.name || "";
  els.firstName.value = profile.firstName || "";
  els.lastName.value = profile.lastName || "";
  els.email.value = profile.email || "";
  els.phone.value = profile.phone || "";
  els.location.value = profile.location || "";
  els.city.value = profile.city || "";
  els.state.value = profile.state || "";
  els.zip.value = profile.zip || "";
  els.address.value = profile.address || "";
  els.linkedin.value = profile.linkedin || "";
  els.github.value = profile.github || "";
  els.website.value = profile.website || "";
  els.currentTitle.value = profile.currentTitle || "";
  els.currentCompany.value = profile.currentCompany || "";
  els.school.value = profile.school || "";
  els.degree.value = profile.degree || "";
  els.gradYear.value = profile.gradYear || "";
  els.yearsExperience.value = profile.yearsExperience || "";
  els.skills.value = (profile.skills || []).join(", ");
  els.summary.value = profile.summary || "";
  rawResumeText = profile.rawText || "";
}

function readProfileFromFields() {
  return {
    name: els.name.value.trim(),
    firstName: els.firstName.value.trim(),
    lastName: els.lastName.value.trim(),
    email: els.email.value.trim(),
    phone: els.phone.value.trim(),
    location: els.location.value.trim(),
    city: els.city.value.trim(),
    state: els.state.value.trim(),
    zip: els.zip.value.trim(),
    address: els.address.value.trim(),
    linkedin: els.linkedin.value.trim(),
    github: els.github.value.trim(),
    website: els.website.value.trim(),
    currentTitle: els.currentTitle.value.trim(),
    currentCompany: els.currentCompany.value.trim(),
    school: els.school.value.trim(),
    degree: els.degree.value.trim(),
    gradYear: els.gradYear.value.trim(),
    yearsExperience: els.yearsExperience.value.trim(),
    skills: els.skills.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    summary: els.summary.value.trim(),
    rawText: rawResumeText,
  };
}

function loadSavedProfile() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (result[STORAGE_KEY]) {
      populateFieldsFromProfile(result[STORAGE_KEY]);
    }
  });
}

els.resumeFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    rawResumeText = text;
    els.resumePaste.value = text;
    const profile = ResumeParser.parseResume(text);
    populateFieldsFromProfile(profile);
  };
  reader.readAsText(file);
});

els.parseBtn.addEventListener("click", () => {
  const text = els.resumePaste.value;
  if (!text.trim()) return;
  rawResumeText = text;
  const profile = ResumeParser.parseResume(text);
  populateFieldsFromProfile(profile);
});

function saveProfile(statusText) {
  const profile = readProfileFromFields();
  chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
    if (statusText) {
      els.saveStatus.textContent = statusText;
      setTimeout(() => (els.saveStatus.textContent = ""), 3000);
    }
  });
}

els.saveBtn.addEventListener("click", () => {
  saveProfile("Saved. Go to \"Fill & Score\" on any job page.");
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Auto-save every profile field as the user types, so nothing is lost when the
// popup closes (Chrome popups close whenever you click away or change tabs).
// Everything lives in chrome.storage.local — on your device, no cloud/account,
// and it persists across page navigations and browser restarts.
const PROFILE_FIELD_KEYS = [
  "name", "firstName", "lastName", "email", "phone", "location", "city", "state",
  "zip", "address", "linkedin", "github", "website", "currentTitle",
  "currentCompany", "school", "degree", "gradYear", "yearsExperience", "skills", "summary",
];

const autoSaveProfile = debounce(() => {
  saveProfile("Saved automatically ✓");
}, 500);

PROFILE_FIELD_KEYS.forEach((key) => {
  const el = els[key];
  if (el) el.addEventListener("input", autoSaveProfile);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "RESUME_FIT_RESULT") {
    renderFillResult(message.payload);
  }
});

els.fillBtn.addEventListener("click", async () => {
  els.fillResult.innerHTML = "<p class=\"hint\">Analyzing page...</p>";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    els.fillResult.innerHTML = "<p class=\"hint\">No active tab found.</p>";
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/matcher.js", "lib/tailor.js", "lib/autofillEngine.js", "content.js"],
    });
    // Result arrives asynchronously via the RESUME_FIT_RESULT message above.
  } catch (err) {
    els.fillResult.innerHTML = `<p class="hint">Couldn't run on this page (${err.message || "restricted page"}).</p>`;
  }
});

function renderFillResult(outcome) {
  if (!outcome) {
    els.fillResult.innerHTML = "<p class=\"hint\">No result returned. Make sure you saved a resume profile first.</p>";
    return;
  }
  if (outcome.error) {
    els.fillResult.innerHTML = `<p class="hint">${outcome.error}</p>`;
    return;
  }

  const { filledCount, draftedCount, flaggedCount, match, tailor } = outcome;
  let html = `<p>✅ Filled <strong>${filledCount}</strong> field(s) with your real info / saved answers.</p>`;
  if (draftedCount) {
    html += `<p>📝 Drafted <strong>${draftedCount}</strong> open-ended answer(s) from your resume — <em>review &amp; personalize before submitting</em> (highlighted in blue).</p>`;
  }
  html += `<p>⚠️ Flagged <strong>${flaggedCount}</strong> field(s) for you to complete manually (highlighted in yellow).</p>`;

  if (match) {
    html += `<p>Job fit score: <span class="score">${match.score}%</span></p>`;
  }

  if (tailor) {
    html += `<hr /><p><strong>Tweak your resume for this role</strong></p>`;
    html += `<p class="hint">Your own skills/bullets, re-ordered for this posting. Nothing here is invented — it's all already on your resume.</p>`;

    if (tailor.leadSkills.length) {
      html += `<p class="hint">Lead with these skills:</p><div class="chip-list">${tailor.leadSkills
        .slice(0, 10)
        .map((s) => `<span class="chip matched">${escapeHtml(s)}</span>`)
        .join("")}</div>`;
    }

    if (tailor.leadBullets.length) {
      html += `<p class="hint">Lead with these bullets:</p><ul class="bullet-list">${tailor.leadBullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join("")}</ul>`;
    }

    if (tailor.gaps.length) {
      html += `<p class="hint">In the posting, not on your resume — add only if genuinely true of you:</p><div class="chip-list">${tailor.gaps
        .map((g) => `<span class="chip missing">${escapeHtml(g)}</span>`)
        .join("")}</div>`;
    }
  }

  els.fillResult.innerHTML = html;
}

// --- Q&A (user-provided answers reused verbatim, never invented) --------

let qaItems = [];

// Persist Q&A edits as they happen (raw, including half-typed rows) so nothing
// is lost when the popup closes. The Save button additionally cleans out empty
// rows.
const autoSaveQa = debounce(() => {
  chrome.storage.local.set({ [QA_STORAGE_KEY]: qaItems });
}, 500);

function renderQaList() {
  els.qaList.innerHTML = "";
  qaItems.forEach((qa, idx) => {
    const row = document.createElement("div");
    row.className = "qa-row";
    row.innerHTML = `
      <div class="qa-row-header">
        <label>Question</label>
        <button class="qa-remove-btn" data-idx="${idx}">Remove</button>
      </div>
      <input type="text" class="qa-question" data-idx="${idx}" placeholder="e.g. Are you authorized to work in the US?" value="${escapeHtml(qa.question)}" />
      <label>Your answer</label>
      <textarea class="qa-answer" data-idx="${idx}" rows="2" placeholder="Your exact answer — this is reused as-is, never changed">${escapeHtml(qa.answer)}</textarea>
    `;
    els.qaList.appendChild(row);
  });

  els.qaList.querySelectorAll(".qa-question").forEach((input) => {
    input.addEventListener("input", (e) => {
      qaItems[Number(e.target.dataset.idx)].question = e.target.value;
      autoSaveQa();
    });
  });
  els.qaList.querySelectorAll(".qa-answer").forEach((textarea) => {
    textarea.addEventListener("input", (e) => {
      qaItems[Number(e.target.dataset.idx)].answer = e.target.value;
      autoSaveQa();
    });
  });
  els.qaList.querySelectorAll(".qa-remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      qaItems.splice(Number(e.target.dataset.idx), 1);
      renderQaList();
      autoSaveQa();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function addQaRow(question) {
  qaItems.push({ question: question || "", answer: "" });
  renderQaList();
  autoSaveQa();
  const textareas = els.qaList.querySelectorAll(".qa-answer");
  const last = textareas[textareas.length - 1];
  if (last) last.focus();
}

function renderQuickAddChips() {
  els.qaQuickAdd.innerHTML = "";
  QUICK_ADD_QUESTIONS.forEach((q) => {
    const chip = document.createElement("button");
    chip.className = "chip quick-add";
    chip.textContent = q;
    chip.addEventListener("click", () => addQaRow(q));
    els.qaQuickAdd.appendChild(chip);
  });
}

function loadQaItems() {
  chrome.storage.local.get([QA_STORAGE_KEY], (result) => {
    qaItems = result[QA_STORAGE_KEY] || [];
    renderQaList();
  });
}

els.addQaBtn.addEventListener("click", () => addQaRow());

els.saveQaBtn.addEventListener("click", () => {
  const cleaned = qaItems.filter((qa) => qa.question.trim() && qa.answer.trim());
  chrome.storage.local.set({ [QA_STORAGE_KEY]: cleaned }, () => {
    qaItems = cleaned;
    renderQaList();
    els.qaSaveStatus.textContent = "Saved.";
    setTimeout(() => (els.qaSaveStatus.textContent = ""), 3000);
  });
});

// --- Floating widget toggle ------------------------------------------

chrome.storage.local.get(["widgetEnabled"], (result) => {
  els.widgetToggle.checked = result.widgetEnabled !== false;
});

els.widgetToggle.addEventListener("change", () => {
  chrome.storage.local.set({ widgetEnabled: els.widgetToggle.checked });
});

// --- Standard self-ID (EEO) default answers --------------------------------

const DEFAULT_EEO = {
  veteran: "I am not a protected veteran",
  disability: "No, I do not have a disability",
  gender: "",
  race: "",
};

function loadDefaults() {
  chrome.storage.local.get(["sensitiveDefaults"], (res) => {
    const d = res.sensitiveDefaults || DEFAULT_EEO;
    els.defVeteran.value = d.veteran || "";
    els.defDisability.value = d.disability || "";
    els.defGender.value = d.gender || "";
    els.defRace.value = d.race || "";
    if (!res.sensitiveDefaults) chrome.storage.local.set({ sensitiveDefaults: DEFAULT_EEO });
  });
}

const autoSaveDefaults = debounce(() => {
  chrome.storage.local.set(
    {
      sensitiveDefaults: {
        veteran: els.defVeteran.value.trim(),
        disability: els.defDisability.value.trim(),
        gender: els.defGender.value.trim(),
        race: els.defRace.value.trim(),
      },
    },
    () => {
      els.defStatus.textContent = "Saved automatically ✓";
      setTimeout(() => (els.defStatus.textContent = ""), 2000);
    }
  );
}, 500);

[els.defVeteran, els.defDisability, els.defGender, els.defRace].forEach((el) =>
  el.addEventListener("input", autoSaveDefaults)
);

// --- Jobs tab: fresh listings ranked against your resume -------------------

function timeAgo(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function renderJobs(listings) {
  els.jobsList.innerHTML = "";
  if (!listings || !listings.jobs || listings.jobs.length === 0) {
    els.jobsList.innerHTML = `<p class="hint">No listings yet. Enter your ZIP and click Refresh to pull a fresh batch.</p>`;
    return;
  }
  const when = new Date(listings.generatedAt);
  const areaLabel = listings.state ? ` · near ${listings.state}` : "";
  els.jobsStatus.textContent = `${listings.jobs.length} openings${areaLabel} · updated ${when.toLocaleString()}`;

  listings.jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";
    const scoreClass = job.score >= 30 ? "good" : job.score >= 18 ? "ok" : "low";
    card.innerHTML = `
      <div class="job-top">
        <span class="job-score ${scoreClass}">${job.score || 0}%</span>
        <a class="job-title" href="${escapeHtml(job.url)}" data-url="${escapeHtml(job.url)}">${escapeHtml(job.title)}</a>
      </div>
      <div class="job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.location || "—")} · ${escapeHtml(job.source)}${
      job.area === "in-area" ? ' · <span class="job-area">in your area / remote</span>' : ""
    } · ${timeAgo(job.postedAt)}</div>
    `;
    els.jobsList.appendChild(card);
  });

  els.jobsList.querySelectorAll(".job-title").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: a.dataset.url });
    });
  });
}

function loadJobs() {
  chrome.runtime.sendMessage({ type: "GET_JOBS" }, (listings) => {
    renderJobs(listings);
  });
}

els.refreshJobsBtn.addEventListener("click", () => {
  const zip = els.jobZip.value.trim();
  els.jobsStatus.textContent = "Fetching fresh listings…";
  els.refreshJobsBtn.disabled = true;
  chrome.storage.local.set({ jobZip: zip }, () => {
    chrome.runtime.sendMessage({ type: "REFRESH_JOBS" }, (r) => {
      els.refreshJobsBtn.disabled = false;
      if (!r || r.error) {
        els.jobsStatus.textContent = `Couldn't refresh (${(r && r.error) || "unknown error"}). Try again.`;
        return;
      }
      renderJobs(r.result);
    });
  });
});

const autoSaveZip = debounce(() => {
  chrome.storage.local.set({ jobZip: els.jobZip.value.trim() });
}, 500);

function loadJobZip() {
  chrome.storage.local.get(["jobZip"], (res) => {
    els.jobZip.value = res.jobZip || "";
  });
}

els.jobZip.addEventListener("input", autoSaveZip);

renderQuickAddChips();
loadQaItems();
loadSavedProfile();
loadDefaults();
loadJobZip();
loadJobs();
