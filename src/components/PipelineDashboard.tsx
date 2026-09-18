import React, { useState, useMemo } from 'react';
import { MGA, GeographicRegion, LineOfBusiness } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { 
  Search, 
  SlidersHorizontal, 
  TrendingUp, 
  Award, 
  Building2, 
  MapPin, 
  DollarSign, 
  ChevronRight, 
  Filter, 
  ArrowUpDown,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface PipelineDashboardProps {
  mgas: MGA[];
  onSelectMGA: (mga: MGA) => void;
  onAddMGAClick: () => void;
  onAcquireMGA: (mgaId: string) => void;
}

export const PipelineDashboard: React.FC<PipelineDashboardProps> = ({
  mgas,
  onSelectMGA,
  onAddMGAClick,
  onAcquireMGA,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedLOB, setSelectedLOB] = useState<string>('all');
  const [minExperience, setMinExperience] = useState<number>(0);
  const [minEbitdaGrowth, setMinEbitdaGrowth] = useState<number>(0);
  const [bestInClassOnly, setBestInClassOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pipeline' | 'Acquired'>('Pipeline');
  const [sortBy, setSortBy] = useState<'growth' | 'ebitda' | 'experience' | 'name'>('growth');

  // Filter and sort
  const filteredMGAs = useMemo(() => {
    return mgas.filter(mga => {
      // Status Filter
      if (statusFilter !== 'All' && mga.status !== statusFilter) return false;

      // Text Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = mga.name.toLowerCase().includes(query);
        const matchCode = mga.code.toLowerCase().includes(query);
        const matchLOB = mga.primary_lob.toLowerCase().includes(query);
        const matchCity = mga.headquarters.city.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchLOB && !matchCity) return false;
      }

      // Region Filter
      if (selectedRegion !== 'all' && mga.primary_region !== selectedRegion) return false;

      // Line of Business Filter
      if (selectedLOB !== 'all' && mga.primary_lob !== selectedLOB) return false;

      // Experience Filter (Mary requirement: 20-30+ years)
      if (mga.years_of_experience < minExperience) return false;

      // Latest financial YoY EBITDA growth
      const latestFin = mga.financials[mga.financials.length - 1];
      const latestGrowth = latestFin ? latestFin.yoy_ebitda_growth_pct : 0;
      if (latestGrowth < minEbitdaGrowth) return false;

      // Best in Class Preset: 20+ years experience AND >20% EBITDA growth
      if (bestInClassOnly) {
        if (mga.years_of_experience < 20 || latestGrowth < 20) return false;
      }

      return true;
    }).sort((a, b) => {
      const aLatestFin = a.financials[a.financials.length - 1];
      const bLatestFin = b.financials[b.financials.length - 1];
      
      if (sortBy === 'growth') {
        return (bLatestFin?.yoy_ebitda_growth_pct || 0) - (aLatestFin?.yoy_ebitda_growth_pct || 0);
      }
      if (sortBy === 'ebitda') {
        return (bLatestFin?.historical_ebitda || 0) - (aLatestFin?.historical_ebitda || 0);
      }
      if (sortBy === 'experience') {
        return b.years_of_experience - a.years_of_experience;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [mgas, statusFilter, searchQuery, selectedRegion, selectedLOB, minExperience, minEbitdaGrowth, bestInClassOnly, sortBy]);

  // Aggregate pipeline metrics
  const pipelineTargets = mgas.filter(m => m.status === 'Pipeline');
  const totalPipelineEV = pipelineTargets.reduce((acc, m) => acc + (m.target_enterprise_value || 0), 0);
  const totalPipelineEBITDA = pipelineTargets.reduce((acc, m) => {
    const fin = m.financials[m.financials.length - 1];
    return acc + (fin?.historical_ebitda || 0);
  }, 0);
  const avgExp = pipelineTargets.length 
    ? (pipelineTargets.reduce((acc, m) => acc + m.years_of_experience, 0) / pipelineTargets.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header with Title & Call Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">M&A Acquisition Pipeline</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
              Corporate Development
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Tracking prospective 20-30+ yr track-record MGA roll-up targets, valuation multiples, and historical EBITDA momentum.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setBestInClassOnly(!bestInClassOnly)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              bestInClassOnly
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800/80 text-amber-300 border-amber-500/40 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {bestInClassOnly ? 'Best-in-Class Filter Active' : 'Filter "Best in Class" (20+ Yrs & High Growth)'}
          </button>
          
          <button
            onClick={onAddMGAClick}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-sky-600/30"
          >
            <PlusCircle className="h-4 w-4" />
            Add Target MGA
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Pipeline Targets</span>
            <Building2 className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{pipelineTargets.length}</span>
            <span className="text-xs text-slate-400">qualified MGAs</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Across 4 distinct deal stages
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Pipeline Enterprise Value</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPipelineEV, true)}</span>
            <span className="text-xs text-slate-400 font-mono">avg multiple 10.5x</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Target capital deployment
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aggregated Target EBITDA</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{formatCurrency(totalPipelineEBITDA, true)}</span>
            <span className="text-xs text-emerald-400 font-semibold">+23.7% avg YoY</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Annual pro-forma EBITDA additions
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Experience Track Record</span>
            <Award className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{avgExp}</span>
            <span className="text-xs text-slate-400 font-medium">Years in Market</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Fulfills 20-30+ Yr requirement
          </div>
        </div>
      </div>

      {/* Filter & Sorting Controls Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search target MGA name, code, line of business, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Status Segment */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            {(['Pipeline', 'Acquired', 'All'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {status === 'Pipeline' ? 'Pipeline Only' : status === 'Acquired' ? 'On-Platform' : 'All MGAs'}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="growth">Sort: Highest EBITDA Growth % (Mary Metric)</option>
              <option value="ebitda">Sort: Highest Annual EBITDA ($)</option>
              <option value="experience">Sort: Most Years of Experience (20-30+ Yrs)</option>
              <option value="name">Sort: MGA Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Granular Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/60 text-xs">
          {/* Region */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Geographic Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Regions</option>
              <option value="Northeast">Northeast</option>
              <option value="Southeast">Southeast</option>
              <option value="Midwest">Midwest</option>
              <option value="West / Pacific">West / Pacific</option>
              <option value="Southwest">Southwest</option>
              <option value="National">National</option>
            </select>
          </div>

          {/* Line of Business */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Line of Business (LOB)</label>
            <select
              value={selectedLOB}
              onChange={(e) => setSelectedLOB(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Lines of Business</option>
              <option value="Specialty Casualty">Specialty Casualty</option>
              <option value="Inland & Ocean Marine">Inland & Ocean Marine</option>
              <option value="Commercial Property">Commercial Property</option>
              <option value="Environmental & Energy">Environmental & Energy</option>
              <option value="Cyber Risk & Tech E&O">Cyber Risk & Tech E&O</option>
              <option value="Specialty Excess & Surplus (E&S)">Specialty Excess & Surplus (E&S)</option>
              <option value="Executive Liability / D&O">Executive Liability / D&O</option>
            </select>
          </div>

          {/* Min Experience Slider */}
          <div>
            <div className="flex justify-between text-slate-400 mb-1 font-medium">
              <span>Min Experience</span>
              <span className="text-sky-400 font-mono">{minExperience} Years</span>
            </div>
            <input
              type="range"
              min="0"
              max="35"
              step="5"
              value={minExperience}
              onChange={(e) => setMinExperience(Number(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0 yrs</span>
              <span className="text-amber-400 font-semibold">20+ Yrs (Target)</span>
              <span>35+ yrs</span>
            </div>
          </div>

          {/* Min EBITDA Growth Slider */}
          <div>
            <div className="flex justify-between text-slate-400 mb-1 font-medium">
              <span>Min YoY EBITDA Growth</span>
              <span className="text-emerald-400 font-mono">+{minEbitdaGrowth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="35"
              step="5"
              value={minEbitdaGrowth}
              onChange={(e) => setMinEbitdaGrowth(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0%</span>
              <span className="text-emerald-400 font-semibold">15%+</span>
              <span>35%+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target MGAs Table / Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {statusFilter === 'Pipeline' ? 'Prospective M&A Targets' : statusFilter === 'Acquired' ? 'Acquired Platform MGAs' : 'All MGA Accounts'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {filteredMGAs.length} results
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Click any row to view full historical financials & Retail Agencies ("The Jakes")
          </span>
        </div>

        {filteredMGAs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No MGAs match your current filter criteria</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the experience slider or clearing search terms.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRegion('all');
                setSelectedLOB('all');
                setMinExperience(0);
                setMinEbitdaGrowth(0);
                setBestInClassOnly(false);
              }}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded-lg"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-4">MGA Account & LOB</th>
                  <th className="py-3 px-3">Stage / Status</th>
                  <th className="py-3 px-3">Track Record</th>
                  <th className="py-3 px-3">Latest EBITDA (2025)</th>
                  <th className="py-3 px-3">YoY EBITDA Growth</th>
                  <th className="py-3 px-3">Enterprise Value</th>
                  <th className="py-3 px-3">Region & Carriers</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMGAs.map((mga) => {
                  const latestFin = mga.financials[mga.financials.length - 1];
                  const isAcquired = mga.status === 'Acquired';
                  const isTopGrowth = (latestFin?.yoy_ebitda_growth_pct || 0) >= 20;
                  const isTargetExp = mga.years_of_experience >= 20;

                  return (
                    <tr
                      key={mga.id}
                      onClick={() => onSelectMGA(mga)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Name & Primary LOB */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                            isAcquired 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                          }`}>
                            {mga.code}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
                                {mga.name}
                              </span>
                              {isTargetExp && isTopGrowth && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-0.5">
                                  <Sparkles className="h-2.5 w-2.5" /> Best-in-Class
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                              <span>{mga.primary_lob}</span>
                              <span>•</span>
                              <span>{mga.headquarters.city}, {mga.headquarters.state}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stage / Status */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isAcquired
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                              : mga.pipeline_stage === 'LOI Signed'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                              : mga.pipeline_stage === 'Deal Closing'
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          }`}>
                            {mga.pipeline_stage}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {isAcquired ? `Closed ${mga.acquired_date}` : `${mga.status} Track`}
                          </p>
                        </div>
                      </td>

                      {/* Track Record (Mary 20-30+ Yr requirement) */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className={`font-mono font-bold text-sm ${
                            mga.years_of_experience >= 30 
                              ? 'text-amber-400' 
                              : mga.years_of_experience >= 20 
                              ? 'text-sky-300' 
                              : 'text-slate-300'
                          }`}>
                            {mga.years_of_experience} Years
                          </span>
                          <p className="text-[10px] text-slate-400">Est. {mga.founded_year}</p>
                        </div>
                      </td>

                      {/* Historical EBITDA (2025) */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-sm text-white">
                            {formatCurrency(latestFin?.historical_ebitda || 0)}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {latestFin?.ebitda_margin_pct}% margin
                          </p>
                        </div>
                      </td>

                      {/* YoY EBITDA Growth */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            (latestFin?.yoy_ebitda_growth_pct || 0) >= 20
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            <TrendingUp className="h-3 w-3" />
                            {formatPercent(latestFin?.yoy_ebitda_growth_pct || 0, true)}
                          </span>
                          <p className="text-[10px] text-slate-400">vs prior year</p>
                        </div>
                      </td>

                      {/* Valuation / EV */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-mono font-semibold text-slate-200">
                            {formatCurrency(mga.target_enterprise_value, true)}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {mga.valuation_multiple}x multiple
                          </p>
                        </div>
                      </td>

                      {/* Region & Carriers */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1 max-w-[180px]">
                          <div className="flex items-center gap-1 text-slate-300 font-medium">
                            <MapPin className="h-3 w-3 text-sky-400 shrink-0" />
                            <span className="truncate">{mga.primary_region}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {mga.key_carrier_partners.slice(0, 2).join(', ')}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isAcquired && (
                            <button
                              onClick={() => onAcquireMGA(mga.id)}
                              className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-all shadow-sm flex items-center gap-1"
                              title="Advance & Acquire onto Platform"
                            >
                              Acquire
                            </button>
                          )}
                          <button
                            onClick={() => onSelectMGA(mga)}
                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                            title="View Full Profile & Jakes"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
