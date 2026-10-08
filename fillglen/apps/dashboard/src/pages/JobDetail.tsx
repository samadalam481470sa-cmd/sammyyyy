import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EMPTY_PROFILE, scoreMatch } from "@fillglen/core";
import { api, token } from "../api";

export default function JobDetail() {
  const { id } = useParams();
  const [state, setState] = useState<{ applications: any[]; jobs: any[]; events: any[] } | null>(null);
  useEffect(() => {
    if (token()) api("/v1/applications").then(setState).catch(() => {});
  }, []);
  const app = state?.applications?.find((a) => a.id === id);
  const job = state?.jobs?.find((j) => j.id === app?.jobId);
  const events = (state?.events || []).filter((e) => e.applicationId === id);
  if (!app || !job) return <p>Open this record after the extension creates it, or add one from the board.</p>;
  const match = scoreMatch(job.description || job.title || "", EMPTY_PROFILE);
  return (
    <article className="space-y-4">
      <h1 className="text-2xl">{job.title}</h1>
      <p>
        {job.company} · {job.board} · {app.status}
      </p>
      <p className="text-sm">
        Keyword overlap {match.score}. {match.explanation}
      </p>
      <pre className="whitespace-pre-wrap text-sm bg-[#fffbf5] p-4 rounded-xl border max-h-64 overflow-auto">{job.description}</pre>
      <h2>Status timeline</h2>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {e.status} — {e.at}
          </li>
        ))}
      </ul>
    </article>
  );
}
