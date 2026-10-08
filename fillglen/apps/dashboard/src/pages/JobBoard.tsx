import { useState } from "react";
import { api, token } from "../api";

export default function JobBoard() {
  const [q, setQ] = useState("engineer");
  const [jobs, setJobs] = useState<any[]>([]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Job board</h1>
      <p>Public Greenhouse, Lever, and Ashby feeds only. LinkedIn and Indeed are not scraped.</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="bg-pine text-cream px-3 py-2 rounded-lg"
          onClick={async () => {
            if (!token()) return;
            const r = await api(`/v1/jobs/public?q=${encodeURIComponent(q)}`);
            setJobs(r.jobs || []);
          }}
        >
          Search
        </button>
      </div>
      <ul>
        {jobs.map((j) => (
          <li key={j.id} className="border-b py-2">
            <a href={j.url} target="_blank" rel="noreferrer">
              {j.title}
            </a>
            <span className="text-sm text-[#5c6b64]">
              {" "}
              · {j.company} · {j.board} · {j.location}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
