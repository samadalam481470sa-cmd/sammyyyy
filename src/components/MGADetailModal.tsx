import React, { useState } from 'react';
import { MGA, InsuranceProgram, RetailAgency } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { 
  ArrowLeft, 
  Building2, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  DollarSign, 
  Users, 
  Layers, 
  Store, 
  Award, 
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

interface MGADetailModalProps {
  mga: MGA;
  onClose: () => void;
  onAcquire?: (mgaId: string) => void;
  onAddRetailAgency?: (mgaId: string) => void;
}

export const MGADetailModal: React.FC<MGADetailModalProps> = ({
  mga,
  onClose,
  onAcquire,
  onAddRetailAgency,
}) => {
  const [activeTab, setActiveTab] = useState<'financials' | 'programs' | 'jakes' | 'overview'>('financials');

  const latestFin = mga.financials[mga.financials.length - 1];
  const firstFin = mga.financials[0];
  const isAcquired = mga.status === 'Acquired';

  // 5-Year CAGR calculation
  const totalGrowthMultiplier = firstFin && latestFin ? latestFin.historical_ebitda / firstFin.historical_ebitda : 1;
  const numYears = mga.financials.length - 1;
  const cagr = numYears > 0 ? (Math.pow(totalGrowthMultiplier, 1 / numYears) - 1) * 100 : 0;

  // Format financial chart data
  const chartData = mga.financials.map(f => ({
    year: f.fiscal_year,
    ebitda: f.historical_ebitda / 1_000_000,
    gwp: f.gross_written_premium / 1_000_000,
    revenue: f.revenue / 1_000_000,
    growth: f.yoy_ebitda_growth_pct,
    margin: f.ebitda_margin_pct,
    lossRatio: f.loss_ratio_pct,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {mga.code}
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">{mga.name}</h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  isAcquired
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {mga.pipeline_stage}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {mga.legal_name} • Founded {mga.founded_year} ({mga.years_of_experience} Yrs Track Record)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAcquired && onAcquire && (
              <button
                onClick={() => {
                  onAcquire(mga.id);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all"
              >
                Acquire onto Platform
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900 text-xs">
          {[
            { id: 'financials', label: 'Historical EBITDA & Growth', icon: TrendingUp },
            { id: 'programs', label: `Insurance Programs (${mga.programs?.length || 0})`, icon: Layers },
            { id: 'jakes', label: `Retail Agencies - "The Jakes" (${mga.retail_agencies?.length || 0})`, icon: Store },
            { id: 'overview', label: 'Overview & Thesis', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-all ${
                  isActive
                    ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              {/* Financial Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">2025 Run-Rate EBITDA</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {formatCurrency(latestFin?.historical_ebitda || 0)}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {latestFin?.ebitda_margin_pct}% EBITDA margin
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">Latest YoY Growth</span>
                  <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                    +{latestFin?.yoy_ebitda_growth_pct}%
                  </div>
                  <span className="text-[10px] text-slate-400">
                    5-Yr CAGR: <strong className="text-slate-300 font-mono">+{cagr.toFixed(1)}%</strong>
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">2025 Gross Written Premium</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {formatCurrency(latestFin?.gross_written_premium || 0, true)}
                  </div>
                  <span className="text-[10px] text-slate-400">Underwriting volume</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">Carrier Loss Ratio</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {latestFin?.loss_ratio_pct}%
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Top quartile underwriting</span>
                </div>
              </div>

              {/* Chart: 5-Year Time Series EBITDA & Revenue */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Historical EBITDA & YoY Momentum (Mary Requirement)
                    </h3>
                    <p className="text-xs text-slate-400">Earnings before interest, bad debt & taxes (in $ Millions USD)</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> EBITDA ($M)
                    </span>
                    <span className="flex items-center gap-1 text-sky-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span> YoY Growth %
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} unit="M" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        formatter={(val: any, name: any) => [
                          name === 'ebitda' ? `$${Number(val).toFixed(2)}M` : `${Number(val).toFixed(1)}%`,
                          name === 'ebitda' ? 'Historical EBITDA' : 'YoY Growth Rate'
                        ]}
                      />
                      <Bar dataKey="ebitda" name="ebitda" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Table: Year by Year Financials */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Fiscal Year</th>
                      <th className="py-2.5 px-3">EBITDA ($)</th>
                      <th className="py-2.5 px-3">YoY EBITDA Growth</th>
                      <th className="py-2.5 px-3">Gross Written Premium</th>
                      <th className="py-2.5 px-3">Fee / Comm Revenue</th>
                      <th className="py-2.5 px-3">EBITDA Margin</th>
                      <th className="py-2.5 px-4">Loss Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {mga.financials.map((f) => (
                      <tr key={f.fiscal_year} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-200">{f.fiscal_year}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{formatCurrency(f.historical_ebitda)}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-sky-300">+{f.yoy_ebitda_growth_pct}%</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{formatCurrency(f.gross_written_premium, true)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{formatCurrency(f.revenue, true)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{f.ebitda_margin_pct}%</td>
                        <td className="py-2.5 px-4 font-mono text-amber-300">{f.loss_ratio_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INSURANCE PROGRAMS */}
          {activeTab === 'programs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Delegated Underwriting Programs</h3>
                  <p className="text-xs text-slate-400">Programs, coverage structures, carrier partners, and binding authority limits</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mga.programs?.map((prog) => (
                  <div key={prog.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-white">{prog.program_name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                            {prog.line_of_business}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                            {prog.geographic_region}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {formatCurrency(prog.annual_gwp, true)} GWP
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Carrier Partner</span>
                        <span className="font-medium text-slate-200">{prog.carrier_partner}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Coverage Structure</span>
                        <span className="font-medium text-slate-200">{prog.coverage_type}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Underwriting Authority</span>
                        <span className="font-mono text-slate-300">{formatCurrency(prog.underwriting_authority_limit, true)} / risk</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Commission Split</span>
                        <span className="font-mono text-slate-300">{prog.average_commission_rate}% avg</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: RETAIL AGENCIES ("THE JAKES") */}
          {activeTab === 'jakes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/40 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Store className="h-4 w-4 text-purple-400" />
                    Independent Retail Agency Network ("The Jakes")
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Mary Transcript Requirement: Unrelated retail brokers placing policies through this MGA. Foreign Key linked to MGA ID.
                  </p>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Retail Agency Name</th>
                      <th className="py-2.5 px-3">Principal Producer ("Jake")</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Annual Placed Premium</th>
                      <th className="py-2.5 px-3">Active Policies</th>
                      <th className="py-2.5 px-4">Tier / Tenure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {mga.retail_agencies?.map((jake) => (
                      <tr key={jake.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{jake.agency_name}</td>
                        <td className="py-3 px-3">
                          <span className="text-purple-300 font-medium">{jake.principal_agent}</span>
                          <span className="block text-[10px] text-slate-400">{jake.email}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{jake.city}, {jake.state}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">{formatCurrency(jake.annual_placed_premium)}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{jake.active_policies_count} policies</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            jake.tier === 'Platinum'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}>
                            {jake.tier} • {jake.years_partnered} yrs
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: OVERVIEW & THESIS */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Description</span>
                <p className="text-xs text-slate-300 leading-relaxed">{mga.description}</p>
              </div>

              <div className="p-4 bg-slate-950 border border-sky-800/40 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">Lovell Minnick Investment Thesis</span>
                <p className="text-xs text-slate-200 leading-relaxed">{mga.investment_thesis}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Key Executive Leadership</span>
                  <div className="space-y-2 text-xs">
                    {mga.leadership.map((l) => (
                      <div key={l.name} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-0">
                        <div>
                          <span className="font-semibold text-slate-200">{l.name}</span>
                          <span className="block text-[10px] text-slate-400">{l.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400">{l.yearsInIndustry} Yrs Exp</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Corporate Metadata</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Headquarters:</span>
                      <span>{mga.headquarters.address}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Target Valuation Multiple:</span>
                      <span className="font-mono font-bold text-sky-400">{mga.valuation_multiple}x EBITDA</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Roll-Up Attractiveness Score:</span>
                      <span className="font-mono font-bold text-emerald-400">{mga.rating_score}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
