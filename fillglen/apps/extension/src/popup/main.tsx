import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EMPTY_PROFILE, parseResumeText, type Profile } from "@fillglen/core";
import { Logo } from "../panel/QuestionWindow";
import "../panel/styles.css";

type Match = { title: string; company: string; url: string; score: number; source: string; why?: string };

function Popup() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("Paste a resume, then confirm the fields.");
  const [matches, setMatches] = useState<{ count: number; top: Match[] }>({ count: 0, top: [] });
  const [keepApplying, setKeepApplying] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["profile", "apiBase", "sessionToken", "finderMatches", "keepApplying"], (r) => {
      if (r.profile) setProfile(r.profile);
      if (r.finderMatches) setMatches(r.finderMatches);
      setKeepApplying(Boolean(r.keepApplying));
      const base = r.apiBase || "http://127.0.0.1:8787";
      if (r.sessionToken) {
        fetch(`${base}/v1/finder/matches`, { headers: { authorization: `Bearer ${r.sessionToken}` } })
          .then((res) => res.json())
          .then((body) => {
            setMatches(body);
            chrome.storage.local.set({ finderMatches: body });
            const n = body.count ? String(body.count) : "";
            chrome.action.setBadgeText({ text: n });
            chrome.action.setBadgeBackgroundColor({ color: "#1b3a2f" });
          })
          .catch(() => {});
      }
    });
  }, []);

  function save(next: Profile) {
    setProfile(next);
    chrome.storage.local.set({ profile: next });
  }

  return (
    <div className="fg-root" style={{ width: 360 }}>
      <header className="fg-brand">
        <Logo />
        <div>
          <strong>Fillglen</strong>
          <span>Toolbar · Autofill keeps going while Chrome is open</span>
        </div>
      </header>
      <p>{status}</p>
      <textarea
        rows={6}
        placeholder="Paste resume text"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <div className="toolbar">
        <button
          className="primary"
          onClick={() => {
            const parsed = parseResumeText(paste);
            save(parsed);
            setStatus("Parsed. Review name and email, then open an application.");
          }}
        >
          Parse resume
        </button>
        <button
          className="primary"
          onClick={async () => {
            if (!profile.contact.legalName && !paste) {
              setStatus("Paste a resume and parse it first.");
              return;
            }
            if (paste && !profile.contact.email) {
              const parsed = parseResumeText(paste);
              save(parsed);
            }
            await chrome.runtime.sendMessage({ type: "start-keep-applying" });
            setKeepApplying(true);
            setStatus("Keep applying is on. It pulls the built-in researched job list (no 24/7 server required), fills fields and dropdowns, clicks Apply/Next to enter the form, Submit when required fields are filled, then the next job while Chrome stays open. If a CAPTCHA challenge appears, solve it on this screen — Fillglen waits, then continues. It never solves CAPTCHAs.");
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
      <p className="meta">
        New local matches: {matches.count}. Keep applying uses the built-in researched list in this extension; the 24/7 server is optional.
      </p>
      <ol className="qlist">
        {(matches.top || []).map((m) => (
          <li key={m.url} className="qrow">
            <a href={m.url} target="_blank" rel="noreferrer">
              {m.title}
            </a>
            <div className="meta">
              {m.company} · {m.source} · {m.score}
            </div>
          </li>
        ))}
      </ol>
      <p className="meta">
        {keepApplying ? "Keep applying is ON. Badge shows ON, or WAIT if a CAPTCHA needs you." : "Keep applying is off."}{" "}
        LinkedIn Easy Apply is blocked. CAPTCHAs wait for you; they are not solved automatically.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
