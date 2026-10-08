import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await api("/v1/auth/magic", { method: "POST", body: JSON.stringify({ email }) });
        localStorage.setItem("fillglen-token", r.token);
        setMsg("Signed in. In production this would be an emailed magic link.");
        nav("/");
      }}
    >
      <h1 className="text-2xl">Sign in</h1>
      <p className="text-sm text-[#5c6b64]">Email magic link. Google sign-in can plug in here later.</p>
      <input className="w-full border rounded-lg p-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button className="bg-pine text-cream px-4 py-2 rounded-lg">Send link</button>
      <p>{msg}</p>
    </form>
  );
}
