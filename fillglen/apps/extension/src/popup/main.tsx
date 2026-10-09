import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  EMPTY_DISCOVER,
  EMPTY_PROFILE,
  hydrateProfile,
  parseResumeText,
  type DiscoverStatus,
  type Profile,
} from "@fillglen/core";
import { CopyrightNotice, Wordmark } from "../brand";
import "../panel/styles.css";

type Match = { title: string; company: string; url: string; score?: number; source?: string; why?: string; location?: string };

function Popup() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("Paste your resume. Fillglen ranks Texas IT jobs to that resume.");
  const [matches, setMatches] = useState<{ count: number; top: Match[] }>({ count: 0, top: [] });
  const [keepApplying, setKeepApplying] = useState(false);
  const [discover, setDiscover] = useState<DiscoverStatus>(EMPTY_DISCOVER);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["profile", "apiBase", "sessionToken", "finderMatches", "keepApplying", "discoverStatus"], (r) => {
      if (r.profile) setProfile(hydrateProfile(r.profile));
      if (r.finderMatches) setMatches(r.finderMatches);
      if (r.discoverStatus) setDiscover(r.discoverStatus);
      setKeepApplying(Boolean(r.keepApplying));
      const base = r.apiBase || "http://127.0.0.1:8787";
      if (r.sessionToken) {
        fetch(`${base}/v1/finder/matches`, { headers: { authorization: `Bearer ${r.sessionToken}` } })
          .then((res) => res.json())
          .then((body) => {
            setMatches(body);
            chrome.storage.local.set({ finderMatches: body });
          })
          .catch(() => {});
      }
    });
    const onChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.discoverStatus?.newValue) setDiscover(changes.discoverStatus.newValue);
      if (changes.finderMatches?.newValue) setMatches(changes.finderMatches.newValue);
      if (changes.keepApplying) setKeepApplying(Boolean(changes.keepApplying.newValue));
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  function save(next: Profile) {
    setProfile(next);
    chrome.storage.local.set({ profile: next });
  }

  async function refreshQueue() {
    const body = await chrome.runtime.sendMessage({ type: "refresh-queue" });
    if (body?.top) {
      setMatches({ count: body.count || body.top.length, top: body.top });
      chrome.storage.local.set({
        finderMatches: { count: body.count, top: body.top, lookup: body.lookup || body.top },
      });
    }
    if (body?.discover) setDiscover(body.discover);
  }

  return (
    <div className="fg-root fg-popup">
      <Wordmark />
      <p className="fg-lede">{status}</p>

      <section className="fg-card fg-discover">
        <div className="fg-card-head">
          <strong>Texas map scan</strong>
          <span>{keepApplying ? "Running while this widget is on" : "Idle"}</span>
        </div>
        <p className="meta">{discover.note || EMPTY_DISCOVER.note}</p>
        <div className="fg-stats">
          <div>
            <em>{discover.companiesSeen}</em>
            <span>Companies seen</span>
          </div>
          <div>
            <em>{discover.sitesChecked}</em>
            <span>Career sites</span>
          </div>
          <div>
            <em>{discover.mappedFeeds}</em>
            <span>Job feeds</span>
          </div>
        </div>
      </section>

      <section className="fg-card">
        <div className="fg-card-head">
          <strong>Resume</strong>
          <span>Paste, then parse. Matches follow this resume.</span>
        </div>
        <textarea
          rows={9}
          placeholder="Paste the full resume text here"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="toolbar">
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (!paste.trim()) {
                setStatus("Paste a resume first.");
                return;
              }
              setBusy(true);
              const parsed = hydrateProfile(parseResumeText(paste));
              save(parsed);
              setStatus("Parsed. Ranking Texas IT jobs to this resume…");
              try {
                await refreshQueue();
                setStatus("Resume saved. Jobs below are ranked to this resume. Texas IT first.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Parse resume
          </button>
        </div>
        <div className="fg-grid">
          <label>
            Name
            <input
              value={profile.contact.legalName}
              onChange={(e) => save({ ...profile, contact: { ...profile.contact, legalName: e.target.value } })}
            />
          </label>
          <label>
            Email
            <input
              value={profile.contact.email}
              onChange={(e) => save({ ...profile, contact: { ...profile.contact, email: e.target.value } })}
            />
          </label>
        </div>
      </section>

      <div className="toolbar fg-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (!profile.contact.legalName && !paste) {
              setStatus("Paste a resume and parse it first.");
              return;
            }
            if (paste && !profile.contact.email) {
              const parsed = hydrateProfile(parseResumeText(paste));
              save(parsed);
            }
            setBusy(true);
            await chrome.runtime.sendMessage({ type: "start-keep-applying" });
            setKeepApplying(true);
            await refreshQueue();
            setBusy(false);
            setStatus(
              "Keep applying is on. Fillglen scans Texas map companies in the background, ranks jobs to your resume, fills forms, and waits on CAPTCHAs. It never solves CAPTCHAs. Leave Chrome open."
            );
          }}
        >
          Autofill & keep applying
        </button>
        <button
          onClick={async () => {
            await chrome.runtime.sendMessage({ type: "stop-keep-applying" });
            setKeepApplying(false);
            setStatus("Stopped. Fillglen is idle.");
          }}
        >
          Stop
        </button>
        <button
          onClick={async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
          }}
        >
          Open live window
        </button>
      </div>

      <section className="fg-card">
        <div className="fg-card-head">
          <strong>Jobs tailored to this resume</strong>
          <span>{matches.count || 0} sourced openings</span>
        </div>
        <ol className="qlist">
          {(matches.top || []).map((m) => (
            <li key={m.url} className="qrow">
              <a href={m.url} target="_blank" rel="noreferrer">
                {m.title}
              </a>
              <div className="meta">
                {m.company}
                {m.location ? ` · ${m.location}` : ""}
                {m.source ? ` · ${m.source}` : ""}
                {m.score != null ? ` · ${m.score}` : ""}
              </div>
              {m.why ? <p className="hint">{m.why}</p> : null}
            </li>
          ))}
        </ol>
        {!(matches.top || []).length ? (
          <p className="meta">Parse a resume, then keep applying. Matches appear here.</p>
        ) : null}
      </section>

      <p className="meta fg-foot-note">
        {keepApplying
          ? "Widget on: map scan and autofill keep running while Chrome stays open. The API continues 24/7 if it is running."
          : "Keep applying is off."}{" "}
        LinkedIn Easy Apply is blocked. Google Maps is not scraped — OpenStreetMap (and Places API when configured) plus public career pages.
      </p>
      <CopyrightNotice />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
