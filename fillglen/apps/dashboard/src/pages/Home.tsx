import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, token } from "../api";

export default function Home() {
  const [data, setData] = useState<{ applications: { status: string; createdAt: string }[] }>({ applications: [] });
  useEffect(() => {
    if (!token()) return;
    api("/v1/applications").then(setData).catch(() => {});
  }, []);
  const week = data.applications.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 7 * 86400000).length;
  const applied = data.applications.filter((a) => a.status === "applied").length;
  const chart = ["saved", "applied", "phone-screen", "rejected"].map((status) => ({
    status,
    n: data.applications.filter((a) => a.status === status).length,
  }));
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">This week</h1>
      {!token() ? (
        <p>
          <Link className="underline" to="/signin">
            Sign in
          </Link>{" "}
          to sync. The extension still works offline.
        </p>
      ) : null}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card label="Applications this week" value={week} />
        <Card label="Marked applied" value={applied} />
        <Card label="Response rate" value={applied ? `${Math.round((applied / Math.max(data.applications.length, 1)) * 100)}%` : "—"} />
      </div>
      <div className="h-56 bg-[#fffbf5] border border-[#d9d0c4] rounded-xl p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="n" fill="#1b3a2f" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#fffbf5] border border-[#d9d0c4] rounded-xl p-4">
      <div className="text-sm text-[#5c6b64]">{label}</div>
      <div className="text-2xl mt-1">{value}</div>
    </div>
  );
}
