import React, { useState } from 'react';
import { schemaEntities, sqlSchemaDDL } from '../data/schemaDefinitions';
import { 
  Database, 
  Table, 
  Key, 
  Link, 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check, 
  HelpCircle, 
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';

export const SchemaArchitectureView: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<string>(schemaEntities[0].name);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'sql' | 'mary-checklist'>('visual');

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlSchemaDDL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const activeEntity = schemaEntities.find(e => e.name === selectedEntity) || schemaEntities[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Schema & Platform Architecture</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> 7:00 PM Call Spec
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Minimum viable relational database schema mapping Mary's exact transcript requirements to production PostgreSQL tables.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('visual')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              viewMode === 'visual' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Visual ERD & Models
          </button>
          <button
            onClick={() => setViewMode('mary-checklist')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              viewMode === 'mary-checklist' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mary Transcript Checklist
          </button>
          <button
            onClick={() => setViewMode('sql')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              viewMode === 'sql' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Raw SQL DDL
          </button>
        </div>
      </div>

      {/* VIEW 1: VISUAL ERD & ENTITY INSPECTOR */}
      {viewMode === 'visual' && (
        <div className="space-y-6">
          {/* Architecture Concept Map Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {schemaEntities.slice(0, 4).map((ent, idx) => (
              <button
                key={ent.name}
                onClick={() => setSelectedEntity(ent.name)}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  selectedEntity === ent.name
                    ? 'bg-sky-950/60 border-sky-500 ring-1 ring-sky-500/50 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-mono text-[10px] uppercase font-semibold">Entity {idx + 1}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {ent.fields.length} Fields
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white truncate">{ent.name}</h4>
                <p className="text-[11px] font-mono text-sky-400 mt-0.5 truncate">{ent.tableName}</p>
              </button>
            ))}
          </div>

          {/* Relational Entity Detail Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Table className="h-5 w-5 text-sky-400" />
                  <h3 className="text-lg font-bold text-white">{activeEntity.name}</h3>
                  <code className="text-xs bg-slate-950 text-sky-300 px-2 py-0.5 rounded border border-slate-800">
                    {activeEntity.tableName}
                  </code>
                </div>
                <p className="text-xs text-slate-400 mt-1">{activeEntity.description}</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                Category: {activeEntity.category}
              </span>
            </div>

            {/* Fields Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Field Name</th>
                    <th className="py-2.5 px-3">Data Type</th>
                    <th className="py-2.5 px-3">Keys / Constraints</th>
                    <th className="py-2.5 px-4">Field Description</th>
                    <th className="py-2.5 px-4">Mary Transcript Alignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {activeEntity.fields.map((field) => (
                    <tr key={field.name} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-200">
                        {field.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sky-300">
                        {field.type}
                      </td>
                      <td className="py-2.5 px-3">
                        {field.isPrimaryKey && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            <Key className="h-2.5 w-2.5" /> PK
                          </span>
                        )}
                        {field.isForeignKey && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                            <Link className="h-2.5 w-2.5" /> FK → {field.foreignKeyTarget}
                          </span>
                        )}
                        {!field.isPrimaryKey && !field.isForeignKey && field.isRequired && (
                          <span className="text-[10px] text-slate-400">NOT NULL</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {field.description}
                      </td>
                      <td className="py-2.5 px-4">
                        {field.maryTranscriptNote ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            {field.maryTranscriptNote}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Standard M&A attribute</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MARY CALL CONFIRMATION CHECKLIST */}
      {viewMode === 'mary-checklist' && (
        <div className="space-y-6">
          <div className="p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 border border-amber-800/40 rounded-xl">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-white">7:00 PM Call Discussion Script for Mary</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Direct question mapping to confirm if the tracked metrics (EBITDA, Line of Business, Region, The Jakes) match what she expects to see on her screen every morning.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Checklist Item 1: MGA Experience */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">REQUIREMENT 1</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Implemented
                </span>
              </div>
              <h4 className="font-bold text-sm text-white">MGA Years of Experience (20-30+ Years)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Stored as <code className="text-sky-300">years_of_experience (INTEGER)</code> with dedicated Best-in-Class high-speed filtering in the M&A Pipeline dashboard.
              </p>
              <div className="p-2.5 rounded bg-slate-950 text-[11px] text-slate-400 font-mono">
                💬 Mary Prompt: "Mary, we indexed your 20-30+ years threshold directly into the Best-in-Class filter so you can isolate seasoned books with a single click. Does this filter granularity work for your team?"
              </div>
            </div>

            {/* Checklist Item 2: Historical EBITDA */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">REQUIREMENT 2</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Implemented
                </span>
              </div>
              <h4 className="font-bold text-sm text-white">Historical EBITDA (Time-Series YoY Growth)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Stored in child table <code className="text-sky-300">mga_financials</code> (Earnings before interest, bad debt, taxes) with 5-year trend visualizer and automated YoY CAGR calculations.
              </p>
              <div className="p-2.5 rounded bg-slate-950 text-[11px] text-slate-400 font-mono">
                💬 Mary Prompt: "We built the multi-year EBITDA stack to highlight both historical dollar volume and YoY growth momentum. Would you like quarterly EBITDA breakdowns or is annual granularity ideal?"
              </div>
            </div>

            {/* Checklist Item 3: Insurance Programs */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">REQUIREMENT 3</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Implemented
                </span>
              </div>
              <h4 className="font-bold text-sm text-white">Programs: LOB, Coverage Type & Geographic Region</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Relational entity <code className="text-sky-300">insurance_programs</code> tags each underwriting facility by Line of Business, Coverage Type, Region, and Delegated Carrier Partner.
              </p>
              <div className="p-2.5 rounded bg-slate-950 text-[11px] text-slate-400 font-mono">
                💬 Mary Prompt: "Our program tags allow us to detect duplicate programs across acquired MGAs to merge binding authority limits. Does the current list of 9 lines of business cover your pipeline?"
              </div>
            </div>

            {/* Checklist Item 4: Retail Agencies 'The Jakes' */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">REQUIREMENT 4</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Implemented
                </span>
              </div>
              <h4 className="font-bold text-sm text-white">Retail Agencies ("The Jakes") Relational Table</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Independent retail agencies linked via <code className="text-purple-300">associated_mga_id (FK)</code> to track distribution power and unlock cross-selling across the roll-up.
              </p>
              <div className="p-2.5 rounded bg-slate-950 text-[11px] text-slate-400 font-mono">
                💬 Mary Prompt: "We built 'The Jakes' directory so whenever you acquire a new MGA, their retail brokers can immediately be cross-sold programs from other platform MGAs. Is this what you envisioned?"
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: RAW SQL DDL */}
      {viewMode === 'sql' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-mono font-semibold text-slate-200">schema.sql (PostgreSQL 15+)</span>
            </div>
            <button
              onClick={handleCopySQL}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded transition-colors"
            >
              {copiedSQL ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy DDL</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-5 font-mono text-xs text-sky-200/90 bg-slate-950 overflow-x-auto leading-relaxed max-h-[500px]">
            {sqlSchemaDDL}
          </pre>
        </div>
      )}
    </div>
  );
};
