import React, { useState, useMemo } from 'react';
import { RetailAgency, MGA, LineOfBusiness, GeographicRegion } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Store, 
  Search, 
  Filter, 
  MapPin, 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Award,
  Sparkles,
  Phone,
  Mail,
  Users
} from 'lucide-react';

interface RetailAgenciesViewProps {
  retailAgencies: RetailAgency[];
  mgas: MGA[];
  onSelectMGA: (mga: MGA) => void;
}

export const RetailAgenciesView: React.FC<RetailAgenciesViewProps> = ({
  retailAgencies,
  mgas,
  onSelectMGA,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMGAId, setSelectedMGAId] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const mgaLookup = useMemo(() => {
    const map = new Map<string, MGA>();
    mgas.forEach(m => map.set(m.id, m));
    return map;
  }, [mgas]);

  const filteredJakes = useMemo(() => {
    return retailAgencies.filter(agency => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = agency.agency_name.toLowerCase().includes(query);
        const matchAgent = agency.principal_agent.toLowerCase().includes(query);
        const matchCity = agency.city.toLowerCase().includes(query);
        if (!matchName && !matchAgent && !matchCity) return false;
      }

      // MGA Filter
      if (selectedMGAId !== 'all' && agency.associated_mga_id !== selectedMGAId) return false;

      // Tier Filter
      if (selectedTier !== 'all' && agency.tier !== selectedTier) return false;

      // Region Filter
      if (selectedRegion !== 'all' && agency.region !== selectedRegion) return false;

      return true;
    });
  }, [retailAgencies, searchQuery, selectedMGAId, selectedTier, selectedRegion]);

  const totalPlacedPremium = filteredJakes.reduce((acc, j) => acc + j.annual_placed_premium, 0);
  const totalPolicies = filteredJakes.reduce((acc, j) => acc + j.active_policies_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Retail Agency Distribution ("The Jakes")</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-semibold flex items-center gap-1">
              <Store className="h-3.5 w-3.5" /> Independent Broker Network
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Managing the independent retail broker relationships ("The Jakes") managed by each MGA to unlock platform-wide cross-selling.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Retail Agencies</span>
          <div className="text-2xl font-bold text-white mt-1">{filteredJakes.length} Agencies</div>
          <p className="text-xs text-slate-400 mt-0.5">Independent brokerage relationships</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Annual Placed Premium</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPlacedPremium, true)}</div>
          <p className="text-xs text-slate-400 mt-0.5">Aggregated retail production volume</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Policy Count</span>
          <div className="text-2xl font-bold text-purple-300 mt-1">{totalPolicies.toLocaleString()} Policies</div>
          <p className="text-xs text-slate-400 mt-0.5">Underwritten through platform MGAs</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search agency name, agent, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Associated MGA Filter */}
          <div>
            <select
              value={selectedMGAId}
              onChange={(e) => setSelectedMGAId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Associated MGAs</option>
              {mgas.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
          </div>

          {/* Tier */}
          <div>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Volume Tiers</option>
              <option value="Platinum">Platinum ($4M+ Placed)</option>
              <option value="Gold">Gold ($2.5M+ Placed)</option>
              <option value="Silver">Silver (&lt;$2.5M Placed)</option>
            </select>
          </div>

          {/* Region */}
          <div>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Broker Regions</option>
              <option value="Northeast">Northeast</option>
              <option value="Southeast">Southeast</option>
              <option value="Midwest">Midwest</option>
              <option value="West / Pacific">West / Pacific</option>
              <option value="Southwest">Southwest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jakes Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Retail Agency Name</th>
                <th className="py-3 px-3">Principal Broker ("The Jake")</th>
                <th className="py-3 px-3">Associated MGA (Foreign Key)</th>
                <th className="py-3 px-3">Territory</th>
                <th className="py-3 px-3">Annual Placed Premium</th>
                <th className="py-3 px-3">Placed Lines</th>
                <th className="py-3 px-4">Tier & Tenure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredJakes.map((jake) => {
                const associatedMGA = mgaLookup.get(jake.associated_mga_id);

                return (
                  <tr key={jake.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Agency Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100">{jake.agency_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[10px]">
                        <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {jake.phone}</span>
                      </div>
                    </td>

                    {/* Principal "Jake" */}
                    <td className="py-3.5 px-3">
                      <div className="text-purple-300 font-medium">{jake.principal_agent}</div>
                      <div className="text-slate-400 text-[10px] truncate">{jake.email}</div>
                    </td>

                    {/* Associated MGA (FK link) */}
                    <td className="py-3.5 px-3">
                      {associatedMGA ? (
                        <button
                          onClick={() => onSelectMGA(associatedMGA)}
                          className="text-left group"
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-sky-400 group-hover:text-sky-300">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 border border-sky-500/30">
                              {associatedMGA.code}
                            </span>
                            <span className="truncate">{associatedMGA.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            FK: associated_mga_id
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-500">Unassigned MGA</span>
                      )}
                    </td>

                    {/* Territory */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-200">{jake.city}, {jake.state}</div>
                      <div className="text-[10px] text-slate-400">{jake.region}</div>
                    </td>

                    {/* Annual Placed Premium */}
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(jake.annual_placed_premium)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {jake.active_policies_count} active policies
                      </div>
                    </td>

                    {/* Placed Lines */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {jake.primary_lines_placed.map((line) => (
                          <span key={line} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] truncate">
                            {line}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Tier & Tenure */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        jake.tier === 'Platinum'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {jake.tier}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">
                        {jake.years_partnered} yrs partnered
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
