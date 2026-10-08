import { Link } from "react-router-dom";
import { api, token } from "../api";

export default function Settings() {
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl">Settings</h1>
      <p>Fillglen never sells or shares your data. AI keys live only on the server.</p>
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
