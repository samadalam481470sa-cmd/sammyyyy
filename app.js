const targets = [
  { initials: "KM", name: "Keystone Marine", focus: "Marine & Inland", region: "Northeast", years: "29 yrs", growth: "+31%", score: "94" },
  { initials: "AP", name: "Apex Professional", focus: "Professional Liability", region: "Southeast", years: "24 yrs", growth: "+27%", score: "91" },
  { initials: "WC", name: "Westward Casualty", focus: "Construction & Casualty", region: "Mountain West", years: "21 yrs", growth: "+22%", score: "87" },
  { initials: "SA", name: "Sterling Accident", focus: "Accident & Health", region: "National", years: "33 yrs", growth: "+19%", score: "82" },
  { initials: "RC", name: "Redwood Commercial", focus: "Commercial Property", region: "Pacific", years: "28 yrs", growth: "+18%", score: "79" },
  { initials: "FA", name: "Frontier Auto", focus: "Transportation", region: "Midwest", years: "23 yrs", growth: "+16%", score: "76" }
];

const pipelineCards = document.querySelector("#pipelineCards");
pipelineCards.innerHTML = targets.map((target, index) => `
  <article class="target-card">
    <span class="company-logo ${index % 2 ? "gold-bg" : "teal-bg"}">${target.initials}</span>
    <span class="score">${target.score}</span>
    <h3>${target.name}</h3>
    <p>${target.focus} · ${target.region}</p>
    <footer>
      <div>EXPERIENCE<strong>${target.years}</strong></div>
      <div>EBITDA GROWTH<strong class="growth">${target.growth}</strong></div>
    </footer>
  </article>`).join("");

function selectView(view) {
  document.querySelectorAll(".dashboard-view").forEach((element) => element.classList.toggle("active", element.id === `${view}View`));
  document.querySelectorAll("[data-view]").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
}

document.querySelectorAll("[data-view]").forEach((control) => control.addEventListener("click", (event) => {
  event.preventDefault();
  selectView(control.dataset.view);
}));

const dialog = document.querySelector("#addDialog");
document.querySelector("#addMga").addEventListener("click", () => dialog.showModal());
document.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
document.querySelector(".dialog-submit").addEventListener("click", () => {
  dialog.close();
  showToast("MGA record created — ready for enrichment.");
});
document.querySelector("#reviewSynergies").addEventListener("click", () => {
  document.querySelector(".synergy-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("14 high-confidence opportunities are ready to review.");
});
document.querySelector("#expandSynergies").addEventListener("click", () => showToast("Synergy workspace will open with all 14 opportunities."));

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3200);
}
