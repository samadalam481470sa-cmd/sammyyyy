import React, { useState, useMemo } from 'react';
import { MGA, SynergyOpportunity, InsuranceProgram } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { 
  Layers, 
  Sparkles, 
  TrendingUp, 
  Building2, 
  ShieldCheck, 
  Network, 
  Zap, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Map, 
  ChevronRight,
  ArrowUpRight,
  DollarSign,
  Users,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';

interface PortfolioViewProps {
  mgas: MGA[];
  synergies: SynergyOpportunity[];
  onSelectMGA: (mga: MGA) => void;
  onSelectSynergy?: (synergy: SynergyOpportunity) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  mgas,
  synergies,
  onSelectMGA,
}) => {
  const acquiredMGAs = useMemo(() => mgas.filter(m => m.status === 'Acquired'), [mgas]);

  // Aggregate Portfolio Financials
  const aggregatedStats = useMemo(() => {
    let totalEBITDA2025 = 0;
    let totalEBITDA2024 = 0;
    let totalGWP2025 = 0;
    let totalRevenue2025 = 0;
    let totalJakesCount = 0;
    let totalProgramsCount = 0;

    acquiredMGAs.forEach(mga => {
      const fin2025 = mga.financials.find(f => f.fiscal_year === 2025);
      const fin2024 = mga.financials.find(f => f.fiscal_year === 2024);

      if (fin2025) {
        totalEBITDA2025 += fin2025.historical_ebitda;
        totalGWP2025 += fin2025.gross_written_premium;
        totalRevenue2025 += fin2025.revenue;
      }
      if (fin2024) {
        totalEBITDA2024 += fin2024.historical_ebitda;
      }

      totalJakesCount += mga.retail_agencies?.length || 0;
      totalProgramsCount += mga.programs?.length || 0;
    });

    const portfolioYoYGrowth = totalEBITDA2024 > 0
      ? ((totalEBITDA2025 - totalEBITDA2024) / totalEBITDA2024) * 100
      : 0;

    const totalSynergyValue = synergies.reduce((acc, s) => acc + s.estimated_annual_value, 0);
    const capturedSynergyValue = synergies
      .filter(s => s.status === 'Captured' || s.status === 'In Execution')
      .reduce((acc, s) => acc + s.estimated_annual_value, 0);

    return {
      totalEBITDA2025,
      totalGWP2025,
      totalRevenue2025,
      portfolioYoYGrowth,
      totalJakesCount,
      totalProgramsCount,
      totalSynergyValue,
      capturedSynergyValue,
    };
  }, [acquiredMGAs, synergies]);

  // Historical Aggregated Trend Data
  const aggregatedTrendData = useMemo(() => {
    const years = [2021, 2022, 2023, 2024, 2025];
    return years.map(year => {
      const entry: any = { year };
      let yearTotalEBITDA = 0;
      let yearTotalGWP = 0;

      acquiredMGAs.forEach(mga => {
        const fin = mga.financials.find(f => f.fiscal_year === year);
        if (fin) {
          entry[mga.code] = fin.historical_ebitda / 1_000_000;
          yearTotalEBITDA += fin.historical_ebitda;
          yearTotalGWP += fin.gross_written_premium;
        }
      });

      entry.totalEBITDA = yearTotalEBITDA / 1_000_000;
      entry.totalGWP = yearTotalGWP / 1_000_000;
      return entry;
    });
  }, [acquiredMGAs]);

  // Overlap Analysis: Carrier Partner Overlaps across acquired MGAs
  const carrierOverlapAnalysis = useMemo(() => {
    const carrierMap: { [carrier: string]: { mgas: string[]; gwp: number; programCount: number } } = {};
    
    acquiredMGAs.forEach(mga => {
      mga.programs?.forEach(prog => {
        const carrier = prog.carrier_partner;
        if (!carrierMap[carrier]) {
          carrierMap[carrier] = { mgas: [], gwp: 0, programCount: 0 };
        }
        if (!carrierMap[carrier].mgas.includes(mga.name)) {
          carrierMap[carrier].mgas.push(mga.name);
        }
        carrierMap[carrier].gwp += prog.annual_gwp;
        carrierMap[carrier].programCount += 1;
      });
    });

    return Object.entries(carrierMap)
      .map(([carrier, data]) => ({
        carrier,
        mgaCount: data.mgas.length,
        mgas: data.mgas,
        totalGWP: data.gwp,
        programCount: data.programCount,
      }))
      .sort((a, b) => b.totalGWP - a.totalGWP);
  }, [acquiredMGAs]);

  // Line of Business Diversification
  const lobBreakdown = useMemo(() => {
    const lobMap: { [lob: string]: number } = {};
    acquiredMGAs.forEach(mga => {
      mga.programs?.forEach(prog => {
        lobMap[prog.line_of_business] = (lobMap[prog.line_of_business] || 0) + prog.annual_gwp;
      });
    });
    return Object.entries(lobMap).map(([name, gwp]) => ({
      name,
      gwp: gwp / 1_000_000,
    }));
  }, [acquiredMGAs]);

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'synergies' | 'carriers' | 'network'>('overview');

  return (
    <div className="space-y-6">
      {/* Header & Sub-nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Aggregated Portfolio ("The One Platform")</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Lovell Minnick Master View
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Master roll-up dashboard visualizing aggregated performance, line-of-business overlaps, and platform-wide synergy realization.
          </p>
        </div>

        {/* View Segment */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'overview', label: 'Portfolio Overview & Trends' },
            { id: 'synergies', label: 'Synergy Matrix' },
            { id: 'carriers', label: 'Carrier Overlaps' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeSubTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* High-Level Financial Roll-Up KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aggregated EBITDA */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aggregated Run-Rate EBITDA</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{formatCurrency(aggregatedStats.totalEBITDA2025, true)}</span>
            <span className="text-xs font-semibold text-emerald-400 font-mono">
              +{formatPercent(aggregatedStats.portfolioYoYGrowth)} YoY
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across 4 acquired cornerstone MGAs</p>
        </div>

        {/* Aggregated GWP */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Gross Written Premium</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-400">{formatCurrency(aggregatedStats.totalGWP2025, true)}</span>
            <span className="text-xs text-slate-400">annual GWP</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Underwriting leverage & capacity</p>
        </div>

        {/* Identified Synergies */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identified Synergies</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{formatCurrency(aggregatedStats.totalSynergyValue, true)}</span>
            <span className="text-xs text-emerald-400 font-mono">
              {formatCurrency(aggregatedStats.capturedSynergyValue, true)} in flight
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cross-sell & carrier consolidation</p>
        </div>

        {/* Distribution Clout ("The Jakes") */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aggregated Jakes Network</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-300">14 Key Brokerages</span>
            <span className="text-xs text-slate-400 font-mono">1,850+ producers</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Independent retail agency channels</p>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aggregated EBITDA Stacking Chart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Aggregated Historical EBITDA Growth</h3>
                  <p className="text-xs text-slate-400">Stacked contribution by acquired MGA (in $ Millions)</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  +124% 5-Yr Growth
                </span>
              </div>
              
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aggregatedTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} unit="M" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}M`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="CMCU" name="Coastal Marine" stackId="a" fill="#0ea5e9" />
                    <Bar dataKey="ASCG" name="Apex Casualty" stackId="a" fill="#6366f1" />
                    <Bar dataKey="SEER" name="Summit Energy" stackId="a" fill="#10b981" />
                    <Bar dataKey="HCPS" name="Heritage Property" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Total GWP Capacity Expansion Area Chart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Total Gross Written Premium (GWP)</h3>
                  <p className="text-xs text-slate-400">Aggregated underwriting scale expanding carrier clout ($M)</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono">
                  $267.7M Current GWP
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aggregatedTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gwpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} unit="M" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}M`, 'Total GWP']}
                    />
                    <Area type="monotone" dataKey="totalGWP" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#gwpGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Acquired MGAs List & Roll-Up Cards */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Platform Companies (Acquired)</h3>
                <p className="text-xs text-slate-400">The 4 operational pillars under Newport Specialty Partners</p>
              </div>
              <span className="text-xs text-slate-400">Click to inspect individual P&L, programs, and retail agents</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {acquiredMGAs.map((mga) => {
                const fin2025 = mga.financials.find(f => f.fiscal_year === 2025);
                return (
                  <div
                    key={mga.id}
                    onClick={() => onSelectMGA(mga)}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 transition-all cursor-pointer group hover:shadow-lg hover:shadow-sky-500/5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          {mga.code}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {mga.years_of_experience} Yrs Exp
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 group-hover:text-sky-300 transition-colors">
                        {mga.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {mga.primary_lob} • {mga.headquarters.city}, {mga.headquarters.state}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">2025 EBITDA:</span>
                        <span className="font-mono font-bold text-emerald-400">{formatCurrency(fin2025?.historical_ebitda || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">YoY Growth:</span>
                        <span className="font-mono font-bold text-sky-400">+{fin2025?.yoy_ebitda_growth_pct}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">2025 GWP:</span>
                        <span className="font-mono text-slate-300">{formatCurrency(fin2025?.gross_written_premium || 0, true)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Synergies Tab */}
      {activeSubTab === 'synergies' && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-800/40 rounded-xl flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-white">Platform Synergy & Value Creation Matrix</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Mary Requirement: This engine cross-references acquired MGAs by Line of Business, Geography, Retail Distribution ("The Jakes"), and Carrier Partners to isolate EBITDA expansion opportunities for the Lovell Minnick investment committee.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {synergies.map((synergy) => (
              <div
                key={synergy.id}
                className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 uppercase font-semibold">
                      {synergy.type}
                    </span>
                    <h4 className="font-bold text-sm text-slate-100">{synergy.title}</h4>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 border ${
                    synergy.status === 'In Execution'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : synergy.status === 'Captured'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}>
                    {synergy.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {synergy.description}
                </p>

                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Overlap Vector</span>
                    <span className="font-semibold text-sky-300 truncate block">{synergy.overlap_dimension}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Est. Annual Value</span>
                    <span className="font-mono font-bold text-emerald-400 block">
                      {formatCurrency(synergy.estimated_annual_value)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Confidence Score</span>
                    <span className="font-mono font-bold text-amber-400 block">
                      {synergy.confidence_score}%
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                  <Building2 className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="truncate">Involved MGAs: {synergy.mga_names.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carrier Overlaps Tab */}
      {activeSubTab === 'carriers' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Carrier Capacity Consolidation Clout</h3>
                <p className="text-xs text-slate-400">Identifies where multiple acquired MGAs write capacity through the same insurance carriers to negotiate higher commission overrides.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Carrier Capacity Provider</th>
                    <th className="py-3 px-3">Overlapping Acquired MGAs</th>
                    <th className="py-3 px-3">Aggregated GWP</th>
                    <th className="py-3 px-3">Programs Count</th>
                    <th className="py-3 px-3">Negotiating Clout Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {carrierOverlapAnalysis.map((c) => (
                    <tr key={c.carrier} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-100">{c.carrier}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {c.mgas.map((name) => (
                            <span key={name} className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30 text-[10px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {formatCurrency(c.totalGWP, true)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-slate-300">{c.programCount} Active Facilities</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          c.mgaCount >= 3
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {c.mgaCount >= 3 ? 'Tier-1 Master Delegated (Highest Leverage)' : 'Tier-2 Cross-Program Leverage'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
