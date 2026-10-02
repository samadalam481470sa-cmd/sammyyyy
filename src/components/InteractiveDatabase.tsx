import React, { useMemo, useState } from 'react';
import { MGA, SynergyOpportunity, RetailAgency, InsuranceProgram, FinancialYear } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import {
  Database,
  Search,
  Building2,
  TrendingUp,
  Layers,
  Store,
  Sparkles,
  Link2,
  Table2,
  ArrowUpDown,
  Filter,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

type TableId = 'mgas' | 'financials' | 'programs' | 'retail' | 'synergies';

interface FlatFinancial extends FinancialYear {
  mga_id: string;
  mga_name: string;
  mga_code: string;
  status: string;
}

interface FlatProgram extends InsuranceProgram {
  mga_name: string;
  mga_code: string;
  status: string;
}

interface InteractiveDatabaseProps {
  mgas: MGA[];
  retailAgencies: RetailAgency[];
  synergies: SynergyOpportunity[];
  onSelectMGA: (mga: MGA) => void;
}

export const InteractiveDatabase: React.FC<InteractiveDatabaseProps> = ({
  mgas,
  retailAgencies,
  synergies,
  onSelectMGA,
}) => {
  const [activeTable, setActiveTable] = useState<TableId>('mgas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pipeline' | 'Acquired'>('All');
  const [sortKey, setSortKey] = useState<string>('default');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const allPrograms: FlatProgram[] = useMemo(() => {
    return mgas.flatMap((m) =>
      (m.programs || []).map((p) => ({
        ...p,
        mga_name: m.name,
        mga_code: m.code,
        status: m.status,
      }))
    );
  }, [mgas]);

  const allFinancials: FlatFinancial[] = useMemo(() => {
    return mgas.flatMap((m) =>
      m.financials.map((f) => ({
        ...f,
        mga_id: m.id,
        mga_name: m.name,
        mga_code: m.code,
        status: m.status,
      }))
    );
  }, [mgas]);

  const tables = [
    {
      id: 'mgas' as TableId,
      label: 'managing_general_agents',
      title: 'MGAs',
      icon: Building2,
      count: mgas.length,
      description: 'Primary CRM account entity',
      color: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
    },
    {
      id: 'financials' as TableId,
      label: 'mga_financials',
      title: 'Historical EBITDA',
      icon: TrendingUp,
      count: allFinancials.length,
      description: 'Time-series financials (YoY growth)',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    },
    {
      id: 'programs' as TableId,
      label: 'insurance_programs',
      title: 'Insurance Programs',
      icon: Layers,
      count: allPrograms.length,
      description: 'LOB · Coverage · Region tags',
      color: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
    },
    {
      id: 'retail' as TableId,
      label: 'retail_agencies',
      title: 'The Jakes',
      icon: Store,
      count: retailAgencies.length,
      description: 'Retail agencies FK → MGA',
      color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    },
    {
      id: 'synergies' as TableId,
      label: 'portfolio_synergies',
      title: 'Synergies',
      icon: Sparkles,
      count: synergies.length,
      description: 'Cross-platform value creation',
      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    },
  ];

  const filteredMGAs = useMemo(() => {
    let rows = [...mgas];
    if (statusFilter !== 'All') rows = rows.filter((m) => m.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q) ||
          m.primary_lob.toLowerCase().includes(q) ||
          m.primary_region.toLowerCase().includes(q) ||
          m.headquarters.city.toLowerCase().includes(q)
      );
    }
    if (sortKey === 'experience') rows.sort((a, b) => b.years_of_experience - a.years_of_experience);
    if (sortKey === 'ebitda') {
      rows.sort((a, b) => {
        const ae = a.financials[a.financials.length - 1]?.historical_ebitda || 0;
        const be = b.financials[b.financials.length - 1]?.historical_ebitda || 0;
        return be - ae;
      });
    }
    if (sortKey === 'growth') {
      rows.sort((a, b) => {
        const ag = a.financials[a.financials.length - 1]?.yoy_ebitda_growth_pct || 0;
        const bg = b.financials[b.financials.length - 1]?.yoy_ebitda_growth_pct || 0;
        return bg - ag;
      });
    }
    if (sortKey === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [mgas, search, statusFilter, sortKey]);

  const filteredFinancials = useMemo(() => {
    let rows = [...allFinancials];
    if (statusFilter !== 'All') rows = rows.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (f) =>
          f.mga_name.toLowerCase().includes(q) ||
          f.mga_code.toLowerCase().includes(q) ||
          String(f.fiscal_year).includes(q)
      );
    }
    if (sortKey === 'ebitda') rows.sort((a, b) => b.historical_ebitda - a.historical_ebitda);
    if (sortKey === 'growth') rows.sort((a, b) => b.yoy_ebitda_growth_pct - a.yoy_ebitda_growth_pct);
    if (sortKey === 'year') rows.sort((a, b) => b.fiscal_year - a.fiscal_year);
    return rows;
  }, [allFinancials, search, statusFilter, sortKey]);

  const filteredPrograms = useMemo(() => {
    let rows = [...allPrograms];
    if (statusFilter !== 'All') rows = rows.filter((p) => p.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.program_name.toLowerCase().includes(q) ||
          p.line_of_business.toLowerCase().includes(q) ||
          p.coverage_type.toLowerCase().includes(q) ||
          p.geographic_region.toLowerCase().includes(q) ||
          p.carrier_partner.toLowerCase().includes(q) ||
          p.mga_name.toLowerCase().includes(q)
      );
    }
    if (sortKey === 'gwp') rows.sort((a, b) => b.annual_gwp - a.annual_gwp);
    if (sortKey === 'name') rows.sort((a, b) => a.program_name.localeCompare(b.program_name));
    return rows;
  }, [allPrograms, search, statusFilter, sortKey]);

  const filteredRetail = useMemo(() => {
    let rows = [...retailAgencies];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.agency_name.toLowerCase().includes(q) ||
          r.principal_agent.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      rows = rows.filter((r) => {
        const parent = mgas.find((m) => m.id === r.associated_mga_id);
        return parent?.status === statusFilter;
      });
    }
    if (sortKey === 'premium') rows.sort((a, b) => b.annual_placed_premium - a.annual_placed_premium);
    if (sortKey === 'name') rows.sort((a, b) => a.agency_name.localeCompare(b.agency_name));
    return rows;
  }, [retailAgencies, mgas, search, statusFilter, sortKey]);

  const filteredSynergies = useMemo(() => {
    let rows = [...synergies];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.overlap_dimension.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          s.mga_names.some((n) => n.toLowerCase().includes(q))
      );
    }
    if (sortKey === 'value') rows.sort((a, b) => b.estimated_annual_value - a.estimated_annual_value);
    return rows;
  }, [synergies, search, sortKey]);

  const activeCount =
    activeTable === 'mgas'
      ? filteredMGAs.length
      : activeTable === 'financials'
      ? filteredFinancials.length
      : activeTable === 'programs'
      ? filteredPrograms.length
      : activeTable === 'retail'
      ? filteredRetail.length
      : filteredSynergies.length;

  const relationPreview = useMemo(() => {
    if (!selectedRowId) return null;
    if (activeTable === 'mgas') {
      const mga = mgas.find((m) => m.id === selectedRowId);
      if (!mga) return null;
      return {
        title: mga.name,
        links: [
          { label: 'Financial years', count: mga.financials.length, table: 'financials' as TableId },
          { label: 'Insurance programs', count: mga.programs?.length || 0, table: 'programs' as TableId },
          { label: 'Retail agencies (The Jakes)', count: mga.retail_agencies?.length || 0, table: 'retail' as TableId },
        ],
      };
    }
    return null;
  }, [selectedRowId, activeTable, mgas]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight">Interactive Portfolio Database</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> Unified Live Store
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            One interactive database combining MGAs, Historical EBITDA, Insurance Programs, Retail Agencies (&quot;The Jakes&quot;), and Synergies — with searchable joins and relational drill-downs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>
            {mgas.length} MGAs · {allFinancials.length} financial rows · {allPrograms.length} programs · {retailAgencies.length} Jakes · {synergies.length} synergies
          </span>
        </div>
      </div>

      {/* Entity Relationship Strip */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {tables.map((t, idx) => {
          const Icon = t.icon;
          const isActive = activeTable === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTable(t.id);
                setSelectedRowId(null);
                setSortKey('default');
                setSearch('');
              }}
              className={`relative p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? `${t.color} ring-1 ring-white/10 shadow-lg`
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className={`h-4 w-4 ${isActive ? '' : 'text-slate-400'}`} />
                <span className="text-[10px] font-mono font-bold opacity-80">{t.count}</span>
              </div>
              <div className="text-sm font-bold text-white">{t.title}</div>
              <div className="text-[10px] font-mono text-slate-400 truncate">{t.label}</div>
              {idx < tables.length - 1 && (
                <Link2 className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600 z-10" />
              )}
            </button>
          );
        })}
      </div>

      {/* Query Controls */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tables.find((t) => t.id === activeTable)?.label}...`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            {(['All', 'Pipeline', 'Acquired'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === s ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="default">Sort: Default</option>
              {activeTable === 'mgas' && (
                <>
                  <option value="growth">Highest EBITDA Growth</option>
                  <option value="ebitda">Highest EBITDA</option>
                  <option value="experience">Most Years Experience</option>
                  <option value="name">Name A–Z</option>
                </>
              )}
              {activeTable === 'financials' && (
                <>
                  <option value="year">Newest Year</option>
                  <option value="ebitda">Highest EBITDA</option>
                  <option value="growth">Highest YoY Growth</option>
                </>
              )}
              {activeTable === 'programs' && (
                <>
                  <option value="gwp">Highest GWP</option>
                  <option value="name">Program Name</option>
                </>
              )}
              {activeTable === 'retail' && (
                <>
                  <option value="premium">Highest Placed Premium</option>
                  <option value="name">Agency Name</option>
                </>
              )}
              {activeTable === 'synergies' && <option value="value">Highest Annual Value</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-mono">
            SELECT * FROM {tables.find((t) => t.id === activeTable)?.label}
            {statusFilter !== 'All' ? ` WHERE status = '${statusFilter}'` : ''}
            {search ? ` AND search ILIKE '%${search}%'` : ''}
            → {activeCount} rows
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Main Table */}
        <div className="xl:col-span-3 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-bold text-white font-mono">
                {tables.find((t) => t.id === activeTable)?.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {activeCount} rows
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Click a row to inspect related records</span>
          </div>

          <div className="overflow-x-auto max-h-[560px]">
            {activeTable === 'mgas' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">id / code</th>
                    <th className="py-2.5 px-3">name</th>
                    <th className="py-2.5 px-3">status</th>
                    <th className="py-2.5 px-3">years_of_experience</th>
                    <th className="py-2.5 px-3">primary_region</th>
                    <th className="py-2.5 px-3">primary_lob</th>
                    <th className="py-2.5 px-3">latest_ebitda</th>
                    <th className="py-2.5 px-4">yoy_growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMGAs.map((m) => {
                    const fin = m.financials[m.financials.length - 1];
                    return (
                      <tr
                        key={m.id}
                        onClick={() => {
                          setSelectedRowId(m.id);
                        }}
                        onDoubleClick={() => onSelectMGA(m)}
                        className={`cursor-pointer transition-colors ${
                          selectedRowId === m.id ? 'bg-sky-950/40' : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono text-sky-300">{m.code}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-100">{m.name}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                              m.status === 'Acquired'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{m.years_of_experience}</td>
                        <td className="py-2.5 px-3 text-slate-300">{m.primary_region}</td>
                        <td className="py-2.5 px-3 text-slate-300">{m.primary_lob}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400">
                          {formatCurrency(fin?.historical_ebitda || 0)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-sky-300">
                          {formatPercent(fin?.yoy_ebitda_growth_pct || 0, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTable === 'financials' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">mga_id (FK)</th>
                    <th className="py-2.5 px-3">fiscal_year</th>
                    <th className="py-2.5 px-3">historical_ebitda</th>
                    <th className="py-2.5 px-3">yoy_ebitda_growth_pct</th>
                    <th className="py-2.5 px-3">gross_written_premium</th>
                    <th className="py-2.5 px-3">revenue</th>
                    <th className="py-2.5 px-3">ebitda_margin_pct</th>
                    <th className="py-2.5 px-4">loss_ratio_pct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredFinancials.map((f, i) => (
                    <tr
                      key={`${f.mga_id}-${f.fiscal_year}-${i}`}
                      onClick={() => {
                        const mga = mgas.find((m) => m.id === f.mga_id);
                        if (mga) onSelectMGA(mga);
                      }}
                      className="hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-sky-300">{f.mga_code}</span>
                        <span className="block text-[10px] text-slate-400">{f.mga_name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{f.fiscal_year}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        {formatCurrency(f.historical_ebitda)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sky-300">
                        {formatPercent(f.yoy_ebitda_growth_pct, true)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {formatCurrency(f.gross_written_premium, true)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{formatCurrency(f.revenue, true)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{f.ebitda_margin_pct}%</td>
                      <td className="py-2.5 px-4 font-mono text-amber-300">{f.loss_ratio_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTable === 'programs' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">program_name</th>
                    <th className="py-2.5 px-3">mga_id (FK)</th>
                    <th className="py-2.5 px-3">line_of_business</th>
                    <th className="py-2.5 px-3">coverage_type</th>
                    <th className="py-2.5 px-3">geographic_region</th>
                    <th className="py-2.5 px-3">carrier_partner</th>
                    <th className="py-2.5 px-4">annual_gwp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPrograms.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => {
                        const mga = mgas.find((m) => m.id === p.mga_id);
                        if (mga) onSelectMGA(mga);
                      }}
                      className="hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-100">{p.program_name}</td>
                      <td className="py-2.5 px-3 font-mono text-sky-300">{p.mga_code}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          {p.line_of_business}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{p.coverage_type}</td>
                      <td className="py-2.5 px-3 text-slate-300">{p.geographic_region}</td>
                      <td className="py-2.5 px-3 text-slate-300">{p.carrier_partner}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                        {formatCurrency(p.annual_gwp, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTable === 'retail' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">agency_name</th>
                    <th className="py-2.5 px-3">principal_agent</th>
                    <th className="py-2.5 px-3">associated_mga_id (FK)</th>
                    <th className="py-2.5 px-3">city / region</th>
                    <th className="py-2.5 px-3">annual_placed_premium</th>
                    <th className="py-2.5 px-3">active_policies</th>
                    <th className="py-2.5 px-4">tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRetail.map((r) => {
                    const parent = mgas.find((m) => m.id === r.associated_mga_id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => parent && onSelectMGA(parent)}
                        className="hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-semibold text-slate-100">{r.agency_name}</td>
                        <td className="py-2.5 px-3 text-purple-300">{r.principal_agent}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-sky-300">{parent?.code || r.associated_mga_id}</span>
                          <span className="block text-[10px] text-slate-400">{parent?.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {r.city}, {r.state}
                          <span className="block text-[10px] text-slate-400">{r.region}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                          {formatCurrency(r.annual_placed_premium)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{r.active_policies_count}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-purple-500/15 text-purple-300 border-purple-500/40">
                            {r.tier}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTable === 'synergies' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">title</th>
                    <th className="py-2.5 px-3">type</th>
                    <th className="py-2.5 px-3">overlap_dimension</th>
                    <th className="py-2.5 px-3">mga_ids</th>
                    <th className="py-2.5 px-3">estimated_annual_value</th>
                    <th className="py-2.5 px-3">confidence</th>
                    <th className="py-2.5 px-4">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSynergies.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-100 max-w-[220px]">{s.title}</td>
                      <td className="py-2.5 px-3 text-slate-300">{s.type}</td>
                      <td className="py-2.5 px-3 text-sky-300">{s.overlap_dimension}</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">{s.mga_names.join(', ')}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        {formatCurrency(s.estimated_annual_value)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-300">{s.confidence_score}%</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Relation Inspector */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4 h-fit">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Link2 className="h-4 w-4 text-sky-400" />
              Relation Inspector
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Click an MGA row to see joined child tables. Double-click to open the full CRM profile.
            </p>
          </div>

          {relationPreview ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Selected MGA</div>
                <div className="text-sm font-bold text-white mt-1">{relationPreview.title}</div>
              </div>
              {relationPreview.links.map((link) => (
                <button
                  key={link.table}
                  onClick={() => {
                    setActiveTable(link.table);
                    const mga = mgas.find((m) => m.id === selectedRowId);
                    if (mga) setSearch(mga.code);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-colors text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{link.label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{link.table}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-sky-400">{link.count}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  const mga = mgas.find((m) => m.id === selectedRowId);
                  if (mga) onSelectMGA(mga);
                }}
                className="w-full px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
              >
                Open Full MGA Profile
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-950 border border-dashed border-slate-700 text-center">
              <Database className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                Select a row in <span className="font-mono text-sky-400">managing_general_agents</span> to inspect foreign-key relationships.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Schema Map</div>
            <div className="text-[11px] font-mono text-slate-300 leading-relaxed space-y-1">
              <div>mga_financials.mga_id → mgas.id</div>
              <div>insurance_programs.mga_id → mgas.id</div>
              <div>retail_agencies.associated_mga_id → mgas.id</div>
              <div>portfolio_synergies.mga_ids[] → mgas.id</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
