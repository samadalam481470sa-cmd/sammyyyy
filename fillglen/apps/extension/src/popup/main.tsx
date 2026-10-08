import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EMPTY_PROFILE, parseResumeText, type Profile } from "@fillglen/core";
import { Logo } from "../panel/QuestionWindow";
import "../panel/styles.css";

function Popup() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("Paste a resume, then confirm the fields.");

  useEffect(() => {
    chrome.storage.local.get(["profile"], (r) => {
      if (r.profile) setProfile(r.profile);
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
          <span>Toolbar · never submits</span>
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
      <p className="meta">LinkedIn Easy Apply is blocked. You always click Submit.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
