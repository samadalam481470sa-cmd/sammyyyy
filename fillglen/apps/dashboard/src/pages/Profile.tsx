import { useEffect, useState } from "react";
import { EMPTY_PROFILE, hydrateProfile, parseResumeText, type Profile } from "@fillglen/core";
import { api, token } from "../api";
import { Logo } from "../Brand";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("Paste your resume. Jobs on Local jobs and in the extension are ranked to it.");
  useEffect(() => {
    if (token()) api("/v1/profile").then((p) => setProfile(hydrateProfile(p))).catch(() => {});
  }, []);
  async function save() {
    if (token()) await api("/v1/profile", { method: "PUT", body: JSON.stringify(profile) });
    setMsg("Profile saved. Texas IT search will use this resume.");
  }
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center gap-4">
        <Logo size={44} />
        <div>
          <h1 className="text-2xl">Profile & resume</h1>
          <p className="text-sm text-[#5c6b64]">Spacious review before anything is used to fill or search.</p>
        </div>
      </div>
      <p className="text-[#5c6b64]">{msg}</p>
      <section className="bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl p-6 space-y-4">
        <div className="flex justify-between gap-4 items-baseline">
          <h2 className="text-lg">Resume</h2>
          <span className="text-sm text-[#5c6b64]">Paste the full text</span>
        </div>
        <textarea
          rows={10}
          className="w-full"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste resume"
        />
        <button
          className="bg-pine text-cream px-4 py-2.5 rounded-xl"
          onClick={() => {
            setProfile(hydrateProfile(parseResumeText(paste)));
            setMsg("Parsed. Review name and email, then save.");
          }}
        >
          Parse resume
        </button>
      </section>
      <section className="bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl p-6">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
          {(["legalName", "email", "phone", "city", "state"] as const).map((k) => (
            <label key={k} className="block">
              {k === "legalName" ? "Name" : k}
              <input
                value={profile.contact[k] || ""}
                onChange={(e) => setProfile({ ...profile, contact: { ...profile.contact, [k]: e.target.value } })}
              />
            </label>
          ))}
        </div>
        <p className="text-sm mt-6 text-[#5c6b64]">
          Defaults: US citizen, authorized to work in the US, no visa sponsorship. Sex/race default to decline-to-identify when
          that option exists; veteran defaults to not a protected veteran. Encrypted at rest.
        </p>
        <label className="flex gap-2 items-center mt-4 w-fit">
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
          US citizen
        </label>
        <button onClick={save} className="border px-4 py-2.5 rounded-xl mt-6">
          Save profile
        </button>
      </section>
    </div>
  );
}
