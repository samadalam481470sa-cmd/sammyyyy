import { useEffect, useState } from "react";
import { DEFAULT_SEARCH, type SearchSettings } from "@fillglen/core";
import { api, token } from "../api";

export default function SavedSearches() {
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SEARCH);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token()) return;
    api("/v1/finder/settings").then(setSettings).catch(() => {});
  }, []);

  function set<K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!token()) return setMsg("Sign in first.");
        await api("/v1/finder/settings", { method: "PUT", body: JSON.stringify(settings) });
        setMsg("Saved. The hourly server job will use these filters.");
      }}
    >
      <h1 className="text-2xl">Saved searches</h1>
      <p className="text-sm text-[#5c6b64]">
        Defaults cover US IT roles with Texas preferred. The Chrome extension does not search. These settings run on the
        server every hour.
      </p>
      <label>
        Home city
        <input value={settings.homeCity} onChange={(e) => set("homeCity", e.target.value)} />
      </label>
      <label>
        Radius (miles)
        <input type="number" value={settings.radiusMiles} onChange={(e) => set("radiusMiles", Number(e.target.value))} />
      </label>
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={settings.remoteOk} onChange={(e) => set("remoteOk", e.target.checked)} />
        Remote welcome
      </label>
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={settings.hybridOk} onChange={(e) => set("hybridOk", e.target.checked)} />
        Hybrid welcome
      </label>
      <label>
        Target titles (comma)
        <input value={settings.titles.join(", ")} onChange={(e) => set("titles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </label>
      <label>
        Niche keywords (comma)
        <input
          value={settings.nicheKeywords.join(", ")}
          onChange={(e) => set("nicheKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </label>
      <label>
        Industries (comma)
        <input
          value={(settings.industries || []).join(", ")}
          onChange={(e) => set("industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </label>
      <label>
        Experience
        <select value={settings.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value as SearchSettings["experienceLevel"])}>
          <option value="intern">Intern</option>
          <option value="new-grad">New grad</option>
          <option value="entry">Entry level</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
        </select>
      </label>
      <label>
        Salary floor
        <input
          type="number"
          value={settings.salaryFloor ?? ""}
          onChange={(e) => set("salaryFloor", e.target.value ? Number(e.target.value) : null)}
        />
      </label>
      <label>
        Visa sponsorship
        <select
          value={settings.needsSponsorship == null ? "either" : settings.needsSponsorship ? "yes" : "no"}
          onChange={(e) =>
            set("needsSponsorship", e.target.value === "either" ? null : e.target.value === "yes")
          }
        >
          <option value="either">No preference</option>
          <option value="yes">I need sponsorship</option>
          <option value="no">I do not need sponsorship</option>
        </select>
      </label>
      <label>
        Companies to exclude (comma)
        <input
          value={settings.excludeCompanies.join(", ")}
          onChange={(e) => set("excludeCompanies", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </label>
      <label>
        Alerts
        <select value={settings.alertTiming} onChange={(e) => set("alertTiming", e.target.value as SearchSettings["alertTiming"])}>
          <option value="instant">Instant</option>
          <option value="daily">Daily digest</option>
          <option value="weekly">Weekly digest</option>
        </select>
      </label>
      <label>
        Score threshold
        <input type="number" value={settings.scoreThreshold} onChange={(e) => set("scoreThreshold", Number(e.target.value))} />
      </label>
      <label>
        Add a company by careers URL
        <AddCompany />
      </label>
      <button className="bg-pine text-cream px-3 py-2 rounded-lg">Save search</button>
      <p className="text-sm">{msg}</p>
    </form>
  );
}

function AddCompany() {
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [out, setOut] = useState("");
  return (
    <div className="flex flex-col gap-2 mt-1">
      <input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
      <input placeholder="https://boards.greenhouse.io/acme" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button
        type="button"
        onClick={async () => {
          if (!token()) return;
          const r = await api("/v1/finder/employers", { method: "POST", body: JSON.stringify({ company, careersUrl: url }) });
          setOut(r.slug ? `Mapped to ${r.board} / ${r.slug}` : "No public feed detected — stored as unmapped.");
        }}
      >
        Map company
      </button>
      <span className="text-xs">{out}</span>
    </div>
  );
}
