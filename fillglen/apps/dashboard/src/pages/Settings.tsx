import { Link } from "react-router-dom";
import { EMPTY_PROFILE, hydrateProfile, type Profile } from "@fillglen/core";
import { api, token } from "../api";
import { usePersistedState } from "../persist";

export default function Settings() {
  const [profile, setProfile] = usePersistedState<Profile>("profile", EMPTY_PROFILE);
  const [msg, setMsg] = usePersistedState("settings-msg", "");
  const saved = hydrateProfile(profile);

  const policyOn = saved.preferences.unknownAnswerPolicy === "resume-then-no";

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl">Settings</h1>
      <p>Fillglen never sells or shares your data. AI keys live only on the server.</p>

      <section className="bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl p-6 space-y-3">
        <h2 className="text-lg">Unknown questions</h2>
        <label className="flex gap-2 items-start">
          <input
            type="checkbox"
            checked={policyOn}
            onChange={() => {
              const next = hydrateProfile({
                ...saved,
                preferences: { ...saved.preferences, unknownAnswerPolicy: "resume-then-no" },
              });
              setProfile(next);
              if (token()) api("/v1/profile", { method: "PUT", body: JSON.stringify(next) }).catch(() => {});
              setMsg("Saved. Unknown questions use the resume; if it is not on the resume the answer is No.");
            }}
          />
          <span>
            If there is a question Fillglen does not already know, answer from the resume. If it is not on the resume,
            the answer is <strong>No</strong>. Name, email, address, EEO, and consent fields are never filled with No.
          </span>
        </label>
        <p className="text-sm text-[#5c6b64]">This setting is on by default and is saved with your profile.</p>
        {msg ? <p className="text-sm">{msg}</p> : null}
      </section>

      <Link className="underline" to="/privacy">
        Privacy policy
      </Link>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!token()) return;
            const data = await api("/v1/export");
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "fillglen-export.json";
            a.click();
          }}
        >
          Export my data
        </button>
        <button
          onClick={async () => {
            if (!token()) return;
            if (!confirm("Delete account and all Fillglen data?")) return;
            await api("/v1/account", { method: "DELETE" });
            localStorage.removeItem("fillglen-token");
          }}
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
