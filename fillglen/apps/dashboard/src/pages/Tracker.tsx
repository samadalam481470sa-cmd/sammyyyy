import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, token } from "../api";
import { usePersistedState } from "../persist";

const COLS = ["saved", "applied", "phone-screen", "technical", "final", "offer", "rejected", "withdrawn"];

export default function Tracker() {
  const [view, setView] = usePersistedState<"board" | "table">("tracker-view", "board");
  const [state, setState] = useState<{ applications: any[]; jobs: any[] }>({ applications: [], jobs: [] });
  useEffect(() => {
    if (token()) api("/v1/applications").then(setState).catch(() => {});
  }, []);
  const job = (id: string) => state.jobs.find((j) => j.id === id);
  async function move(id: string, status: string) {
    await api(`/v1/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setState(await api("/v1/applications"));
  }
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Tracker</h1>
        <div className="flex gap-2">
          <button onClick={() => setView("board")}>Board</button>
          <button onClick={() => setView("table")}>Table</button>
          <a href="http://localhost:8787/v1/applications.csv" onClick={(e) => { if (!token()) e.preventDefault(); }}>
            CSV
          </a>
        </div>
      </div>
      {view === "board" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 overflow-x-auto">
          {COLS.map((col) => (
            <div key={col} className="bg-[#fffbf5] rounded-xl p-2 min-h-[160px] border border-[#d9d0c4]">
              <h2 className="text-sm capitalize mb-2">{col.replace("-", " ")}</h2>
              {state.applications
                .filter((a) => a.status === col)
                .map((a) => (
                  <Link key={a.id} to={`/tracker/${a.id}`} className="block bg-white p-2 rounded mb-2 border" draggable onDragStart={(e) => e.dataTransfer.setData("id", a.id)}>
                    <div className="font-medium">{job(a.jobId)?.title || "Role"}</div>
                    <div className="text-xs">{job(a.jobId)?.company}</div>
                  </Link>
                ))}
              <div
                className="h-8"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("id");
                  if (id) move(id, col);
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.applications.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/tracker/${a.id}`}>{job(a.jobId)?.title}</Link>
                </td>
                <td>{job(a.jobId)?.company}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
