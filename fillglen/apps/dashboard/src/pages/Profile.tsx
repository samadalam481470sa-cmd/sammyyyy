import { useEffect, useState } from "react";
import { EMPTY_PROFILE, hydrateProfile, parseResumeText, type Profile } from "@fillglen/core";
import { api, token } from "../api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  useEffect(() => {
    if (token()) api("/v1/profile").then((p) => setProfile(hydrateProfile(p))).catch(() => {});
  }, []);
  async function save() {
    if (token()) await api("/v1/profile", { method: "PUT", body: JSON.stringify(profile) });
  }
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl">Profile</h1>
      <p>Upload or paste a resume. Review every section before it is used to fill.</p>
      <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste resume" />
      <button
        className="bg-pine text-cream px-3 py-2 rounded-lg"
        onClick={() => setProfile(hydrateProfile(parseResumeText(paste)))}
      >
        Parse
      </button>
      {(["legalName", "email", "phone", "city", "state"] as const).map((k) => (
        <label key={k} className="block">
          {k}
          <input
            value={(profile.contact as any)[k] || ""}
            onChange={(e) => setProfile({ ...profile, contact: { ...profile.contact, [k]: e.target.value } })}
          />
        </label>
      ))}
      <p className="text-sm">
        Defaults: US citizen, authorized to work in the US, no visa sponsorship. Sex/race default to decline-to-identify when
        that option exists; veteran defaults to not a protected veteran. Encrypted at rest.
      </p>
      <label className="block">
        US citizen
        <input
          type="checkbox"
          checked={profile.preferences.usCitizen !== false}
          onChange={(e) =>
            setProfile({
              ...profile,
              preferences: { ...profile.preferences, usCitizen: e.target.checked, workAuthorized: e.target.checked || profile.preferences.workAuthorized },
            })
          }
        />
      </label>
      <button onClick={save} className="border px-3 py-2 rounded-lg">
        Save profile
      </button>
    </div>
  );
}
