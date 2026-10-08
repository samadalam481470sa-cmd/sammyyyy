import { useMemo, useState } from "react";
import {
  classifyQuestion,
  EMPTY_PROFILE,
  planPage,
  stableQuestionId,
  type Profile,
  type Question,
  type ScanSnapshot,
} from "@fillglen/core";
import { QuestionWindow } from "@panel/QuestionWindow";

const FIELDS: { label: string; name: string; required?: boolean; kind?: Question["kind"]; type?: string }[] = [
  { label: "First name", name: "first_name", required: true },
  { label: "Last name", name: "last_name", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "Phone", name: "phone" },
  { label: "Are you legally authorized to work in the United States?", name: "auth", required: true },
  { label: "Will you require visa sponsorship?", name: "visa", required: true },
  { label: "How did you hear about this job?", name: "hear" },
  { label: "Why do you want to work here?", name: "why", kind: "textarea" },
  { label: "Gender", name: "gender" },
];

const demoProfile: Profile = {
  ...EMPTY_PROFILE,
  contact: {
    ...EMPTY_PROFILE.contact,
    legalName: "Sam Rivera",
    email: "sam.rivera@example.com",
    phone: "214-555-0100",
    city: "Dallas",
    state: "TX",
  },
  answers: [
    { id: "1", pattern: "how did you hear about this job", answer: "Company careers page", tags: [], useCount: 1, lastUsedAt: null },
  ],
  rawResumeText: "Sam Rivera. Software engineer. TypeScript, React, PostgreSQL.",
};

function questionsFromForm(values: Record<string, string>): Question[] {
  return FIELDS.map((f, position) => {
    const classified = classifyQuestion({ label: f.label, name: f.name, inputType: f.type }, demoProfile.answers);
    const value = values[f.name] || "";
    return {
      id: stableQuestionId({ label: f.label, name: f.name, position }),
      label: f.label,
      required: Boolean(f.required),
      kind: f.kind || "text",
      type: classified.type,
      value,
      source: value ? "user" : "none",
      status: value ? "filled" : "needs-you",
      confidence: classified.via === "unknown" ? "check-this" : "high",
      name: f.name,
      position,
    } satisfies Question;
  });
}

export default function LiveDemo() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [paused, setPaused] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { questionId: string; text: string; usedFacts: string[]; refused: boolean; reason?: string }>>({});
  const questions = useMemo(() => questionsFromForm(values), [values]);
  const snapshot: ScanSnapshot = {
    job: {
      company: "North Glen Labs",
      title: "Software Engineer",
      board: "Greenhouse",
      url: "https://boards.greenhouse.io/northglen/jobs/1",
      description: "Required: TypeScript, React, PostgreSQL. Dallas / remote.",
      feedScore: 82,
      feedWhy: "Title matches software engineer and the posting is in DFW.",
      feedSource: "greenhouse",
      stepLabel: "Application Questions",
      stepIndex: 2,
      stepTotal: 4,
    },
    questions,
  };

  function setById(id: string, value: string) {
    const q = questions.find((x) => x.id === id);
    if (!q?.name) return;
    setValues((v) => ({ ...v, [q.name!]: value }));
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl">Live question window</h1>
      <p className="text-sm text-[#5c6b64]">
        This is the same panel the Chrome side panel uses. Fill this step never clicks Submit. Autofill & keep applying
        (in the extension) fills dropdowns, clicks Next/Submit, and continues while Chrome is open. LinkedIn Easy Apply
        stays blocked.
      </p>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <form
          className="bg-[#fffbf5] border border-[#d9d0c4] rounded-2xl p-4 space-y-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <h2 className="text-lg">North Glen Labs — Software Engineer</h2>
          {FIELDS.map((f) => (
            <label key={f.name} className="block text-sm">
              {f.label}
              {f.kind === "textarea" ? (
                <textarea value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <input value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </label>
          ))}
          <button type="submit" className="bg-[#9b2c2c] text-white px-3 py-2 rounded-lg">
            Submit application
          </button>
          <p className="text-xs text-[#5c6b64]">That Submit button is yours. Fillglen will not press it.</p>
        </form>
        <div className="border border-[#d9d0c4] rounded-2xl overflow-hidden max-h-[80vh] overflow-y-auto">
          <QuestionWindow
            snapshot={snapshot}
            profile={demoProfile}
            paused={paused}
            drafts={drafts}
            onFillPage={() => {
              const plans = planPage(questions, demoProfile);
              const next = { ...values };
              for (const p of plans) {
                const q = questions.find((x) => x.id === p.questionId);
                if (q?.name && p.value) next[q.name] = p.value;
              }
              setValues(next);
            }}
            onFillOne={setById}
            onFocus={() => {}}
            onSaveAnswer={() => {}}
            onUndo={() => setValues({})}
            onPause={() => setPaused((p) => !p)}
            onDraft={(id) => {
              const q = questions.find((x) => x.id === id);
              if (q?.type === "gender") {
                setDrafts((d) => ({ ...d, [id]: { questionId: id, text: "", usedFacts: [], refused: true, reason: "Self-identification never goes to the model." } }));
                return;
              }
              setDrafts((d) => ({
                ...d,
                [id]: {
                  questionId: id,
                  text: "I want this role because I have shipped TypeScript services and live in Dallas.",
                  usedFacts: ["TypeScript services", "Dallas"],
                  refused: false,
                },
              }));
            }}
            onInsertDraft={setById}
            onEdit={setById}
          />
        </div>
      </div>
    </div>
  );
}
