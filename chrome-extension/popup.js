const STORAGE_KEY = "resumeProfile";

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
  name: document.getElementById("fName"),
  firstName: document.getElementById("fFirstName"),
  lastName: document.getElementById("fLastName"),
  email: document.getElementById("fEmail"),
  phone: document.getElementById("fPhone"),
  location: document.getElementById("fLocation"),
  linkedin: document.getElementById("fLinkedin"),
  website: document.getElementById("fWebsite"),
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
  els.linkedin.value = profile.linkedin || "";
  els.website.value = profile.website || "";
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
    linkedin: els.linkedin.value.trim(),
    website: els.website.value.trim(),
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

els.saveBtn.addEventListener("click", () => {
  const profile = readProfileFromFields();
  chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
    els.saveStatus.textContent = "Saved. Go to \"Fill & Score\" on any job page.";
    setTimeout(() => (els.saveStatus.textContent = ""), 3000);
  });
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
      files: ["lib/matcher.js", "content.js"],
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

  const { filledCount, flaggedCount, match } = outcome;
  let html = `<p>Filled <strong>${filledCount}</strong> field(s) with your real info. Flagged <strong>${flaggedCount}</strong> field(s) for you to complete manually (highlighted in yellow on the page).</p>`;

  if (match) {
    html += `<p>Job fit score: <span class="score">${match.score}%</span></p>`;
    if (match.matched.length) {
      html += `<p class="hint">Matched keywords:</p><div class="chip-list">${match.matched
        .map((m) => `<span class="chip matched">${m}</span>`)
        .join("")}</div>`;
    }
    if (match.missing.length) {
      html += `<p class="hint">Keywords in the posting not found in your resume:</p><div class="chip-list">${match.missing
        .map((m) => `<span class="chip missing">${m}</span>`)
        .join("")}</div>`;
    }
  }

  els.fillResult.innerHTML = html;
}

loadSavedProfile();
