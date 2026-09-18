import { SectionIntro } from "@/components/ui";

const entities = [
  {
    name: "MGA",
    role: "Primary CRM account",
    fields: [
      { name: "id", type: "PK" },
      { name: "name", type: "string" },
      { name: "Years_of_Experience", type: "integer", note: "Target 20–30+" },
      {
        name: "Status",
        type: "enum",
        note: "pipeline | acquired (On-Platform)",
      },
      { name: "primaryRegion", type: "string/tag" },
      { name: "headquarters", type: "string" },
    ],
  },
  {
    name: "MGA_Financials",
    role: "Historical time-series",
    fields: [
      { name: "id", type: "PK" },
      { name: "mgaId", type: "FK → MGA" },
      { name: "year", type: "integer" },
      {
        name: "Historical_EBITDA",
        type: "number (USD mm)",
        note: "YoY growth derived in UI",
      },
    ],
  },
  {
    name: "Insurance_Programs",
    role: "Many per MGA",
    fields: [
      { name: "id", type: "PK" },
      { name: "mgaId", type: "FK → MGA" },
      { name: "Line_of_Business", type: "string/tag" },
      { name: "Coverage_Type", type: "string/tag" },
      { name: "Geographic_Region", type: "string/tag" },
    ],
  },
  {
    name: "Retail_Agencies",
    role: '"The Jakes"',
    fields: [
      { name: "id", type: "PK" },
      { name: "name", type: "string" },
      { name: "Associated_MGA", type: "FK → MGA" },
      { name: "city / state", type: "string" },
      { name: "premiumVolumeMm", type: "number (optional)" },
    ],
  },
];

export default function SchemaPage() {
  return (
    <div>
      <SectionIntro
        eyebrow="Week-0 deliverable · Confirm with Mary"
        title="Minimum viable database schema"
        description="Exact entities from the transcript, ready for the 7:00 PM review. Ask: do EBITDA, Line of Business, and Region capture what leadership needs on screen?"
      />

      <div className="animate-rise mb-8 rounded-lg border border-bronze/30 bg-bronze/5 p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Validation questions for Mary</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Is <strong>Historical EBITDA</strong> (annual, USD mm) the right
            growth proof — or do you also need GWP / revenue / loss ratio?
          </li>
          <li>
            Should <strong>Line of Business</strong>,{" "}
            <strong>Coverage Type</strong>, and <strong>Region</strong> be free
            tags, controlled vocabularies, or both?
          </li>
          <li>
            For Best-in-Class filters: is <strong>20+ years</strong> a hard
            floor, or a preference with exceptions?
          </li>
          <li>
            Do &ldquo;The Jakes&rdquo; need their own pipeline status, or only
            linkage under an MGA?
          </li>
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {entities.map((entity, i) => (
          <article
            key={entity.name}
            className="animate-rise rounded-lg border border-line/80 bg-paper/80 p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-bronze">
              {entity.role}
            </p>
            <h3 className="font-display mt-1 text-xl font-semibold text-ink">
              {entity.name}
            </h3>
            <ul className="mt-4 space-y-2">
              {entity.fields.map((f) => (
                <li
                  key={f.name}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/50 pb-2 text-sm last:border-0"
                >
                  <code className="rounded bg-fog px-1.5 py-0.5 text-xs font-semibold text-ink">
                    {f.name}
                  </code>
                  <span className="text-xs text-muted">{f.type}</span>
                  {"note" in f && f.note ? (
                    <span className="w-full text-xs text-teal-deep">
                      {f.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <pre className="animate-rise mt-8 overflow-x-auto rounded-lg border border-line bg-ink p-4 text-xs leading-relaxed text-paper/85">
{`MGA 1──* MGA_Financials     (Historical_EBITDA by year)
MGA 1──* Insurance_Programs (LoB, Coverage, Region)
MGA 1──* Retail_Agencies    (Associated_MGA FK — "The Jakes")

Status: pipeline → acquired (On-Platform)
Derived: YoY_EBITDA_Growth, Synergy overlaps across acquired set`}
      </pre>
    </div>
  );
}
