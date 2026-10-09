import { EMPTY_PROFILE, tailorResume } from "@fillglen/core";
import { usePersistedState } from "../persist";

export default function Resumes() {
  const [desc, setDesc] = usePersistedState("resumes-desc", "Required: TypeScript, React, PostgreSQL");
  const result = tailorResume(
    {
      ...EMPTY_PROFILE,
      work: [
        {
          id: "1",
          company: "North Glen Labs",
          title: "Engineer",
          startDate: "2021",
          endDate: "Present",
          location: "Dallas",
          bullets: [{ text: "Shipped TypeScript services.", tags: ["typescript"] }],
        },
      ],
      skills: [{ name: "TypeScript", category: "lang", years: 4, level: "advanced" }],
      rawResumeText: "TypeScript React PostgreSQL",
    },
    desc,
    ["TypeScript", "React", "COBOL"]
  );
  return (
    <div className="space-y-8">
      <h1 className="text-2xl">Resumes</h1>
      <p>Master resume stays structured. Tailoring reorders and rephrases only skills you have. Missing skills are suggestions, never edits.</p>
      <textarea className="w-full border rounded-lg p-2" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2>Master</h2>
          {result.bullets.map((b) => (
            <p key={b.original} className="text-sm border-b py-2">
              {b.original}
            </p>
          ))}
        </div>
        <div>
          <h2>Tailored (accept each change)</h2>
          {result.bullets.map((b) => (
            <p key={b.proposed} className="text-sm border-b py-2">
              {b.proposed}
              <span className="block text-[#5c6b64]">{b.reason}</span>
            </p>
          ))}
        </div>
      </div>
      <p>Not added: {result.missingSkills.join(", ") || "none"}</p>
      <button className="bg-pine text-cream px-3 py-2 rounded-lg">Export ATS PDF (server render)</button>
    </div>
  );
}
