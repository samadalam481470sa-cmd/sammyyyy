import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { applicationStats } from "@fillglen/core";
import { api, token } from "../api";

export default function Home() {
  const [data, setData] = useState<{ applications: { status: string; createdAt: string }[] }>({ applications: [] });
  const [localCount, setLocalCount] = useState<number | null>(null);
  useEffect(() => {
    if (!token()) return;
    api("/v1/applications").then(setData).catch(() => {});
    api("/v1/finder/matches")
      .then((r) => setLocalCount(r.count || 0))
      .catch(() => {});
  }, []);
  const stats = applicationStats(data.applications);
  const week = stats.week;
  const applied = stats.applied;
  const chart = ["saved", "applied", "phone-screen", "technical", "final", "offer", "rejected"].map((status) => ({
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Applications this week" value={week} />
        <Card label="Marked applied" value={applied} />
        <Card label="Response rate" value={stats.responseRate} />
        <Card label="New local matches" value={localCount == null ? "…" : localCount} />
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
