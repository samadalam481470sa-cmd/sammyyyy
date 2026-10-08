const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export function token(): string | null {
  return localStorage.getItem("fillglen-token");
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}
