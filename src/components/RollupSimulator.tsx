import React, { useState, useMemo } from 'react';
import { MGA } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { 
  SlidersHorizontal, 
  TrendingUp, 
  Building2, 
  PlusCircle, 
  MinusCircle, 
  Sparkles, 
  DollarSign, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

interface RollupSimulatorProps {
  mgas: MGA[];
  onSelectMGA: (mga: MGA) => void;
}

export const RollupSimulator: React.FC<RollupSimulatorProps> = ({
  mgas,
  onSelectMGA,
}) => {
  // Already acquired MGAs are selected by default
  const [selectedMGAIds, setSelectedMGAIds] = useState<string[]>(
    mgas.filter(m => m.status === 'Acquired').map(m => m.id)
  );

  // Synergy realization percentage slider (0% to 100%)
  const [synergyRealizationPct, setSynergyRealizationPct] = useState<number>(75);
  // PE Exit Multiple assumption
  const [exitMultiple, setExitMultiple] = useState<number>(12.5);

  const toggleMGA = (mgaId: string) => {
    if (selectedMGAIds.includes(mgaId)) {
      if (selectedMGAIds.length === 1) return; // keep at least 1
      setSelectedMGAIds(selectedMGAIds.filter(id => id !== mgaId));
    } else {
      setSelectedMGAIds([...selectedMGAIds, mgaId]);
    }
  };

  // Compute aggregated simulated metrics
  const simulatedPortfolio = useMemo(() => {
    const activeMGAs = mgas.filter(m => selectedMGAIds.includes(m.id));

    let total2025EBITDA = 0;
    let total2025GWP = 0;
    let total2025Revenue = 0;
    let totalAcquisitionCost = 0;

    activeMGAs.forEach(mga => {
      const fin = mga.financials.find(f => f.fiscal_year === 2025);
      if (fin) {
        total2025EBITDA += fin.historical_ebitda;
        total2025GWP += fin.gross_written_premium;
        total2025Revenue += fin.revenue;
      }
      totalAcquisitionCost += mga.target_enterprise_value || 0;
    });

    // Estimate dynamic synergies based on combination
    // $1.5M base per acquired entity beyond 2 + 3% carrier consolidation
    const combinedEntitiesCount = activeMGAs.length;
    const estimatedFullSynergy = combinedEntitiesCount > 1 
      ? (combinedEntitiesCount * 1_200_000) + (total2025GWP * 0.015)
      : 0;

    const realizedSynergyValue = estimatedFullSynergy * (synergyRealizationPct / 100);
    const proFormaEBITDA = total2025EBITDA + realizedSynergyValue;
    const simulatedExitValuation = proFormaEBITDA * exitMultiple;
    const valueCreationSpread = simulatedExitValuation - totalAcquisitionCost;
    const moic = totalAcquisitionCost > 0 ? (simulatedExitValuation / totalAcquisitionCost).toFixed(2) : '1.0';

    return {
      activeMGAs,
      total2025EBITDA,
      total2025GWP,
      total2025Revenue,
      totalAcquisitionCost,
      estimatedFullSynergy,
      realizedSynergyValue,
      proFormaEBITDA,
      simulatedExitValuation,
      valueCreationSpread,
      moic,
    };
  }, [mgas, selectedMGAIds, synergyRealizationPct, exitMultiple]);

  // Chart data for standalone vs pro forma
  const simulationChartData = [
    {
      name: 'Baseline Standalone',
      ebitda: simulatedPortfolio.total2025EBITDA / 1_000_000,
      synergy: 0,
      total: simulatedPortfolio.total2025EBITDA / 1_000_000,
    },
    {
      name: 'Pro-Forma with Synergies',
      ebitda: simulatedPortfolio.total2025EBITDA / 1_000_000,
      synergy: simulatedPortfolio.realizedSynergyValue / 1_000_000,
      total: simulatedPortfolio.proFormaEBITDA / 1_000_000,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">M&A Roll-Up & Synergy Simulator</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-semibold flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Lovell Minnick What-If Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Simulate acquiring pipeline MGAs onto the platform to model aggregated EBITDA expansion, carrier leverage, and PE exit valuation multiples.
          </p>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pro-Forma Aggregated EBITDA</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {formatCurrency(simulatedPortfolio.proFormaEBITDA, true)}
          </div>
          <span className="text-xs text-sky-400 font-mono">
            Includes +{formatCurrency(simulatedPortfolio.realizedSynergyValue, true)} synergies
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Simulated Exit Valuation</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {formatCurrency(simulatedPortfolio.simulatedExitValuation, true)}
          </div>
          <span className="text-xs text-slate-400 font-mono">
            At {exitMultiple}x PE exit multiple
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Capital Invested</span>
          <div className="text-2xl font-bold font-mono text-slate-300 mt-1">
            {formatCurrency(simulatedPortfolio.totalAcquisitionCost, true)}
          </div>
          <span className="text-xs text-slate-400">
            Across {simulatedPortfolio.activeMGAs.length} platform companies
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Value Creation Multiple (MOIC)</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {simulatedPortfolio.moic}x MOIC
          </div>
          <span className="text-xs text-emerald-400 font-mono">
            +{formatCurrency(simulatedPortfolio.valueCreationSpread, true)} net spread
          </span>
        </div>
      </div>

      {/* Simulator Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: MGA Selection Grid */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Toggle Portfolio Inclusion</h3>
              <p className="text-xs text-slate-400">Click to include/exclude pipeline targets in this roll-up simulation</p>
            </div>
            <span className="text-xs font-mono text-sky-400">
              {simulatedPortfolio.activeMGAs.length} of {mgas.length} Selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mgas.map((mga) => {
              const isSelected = selectedMGAIds.includes(mga.id);
              const latestFin = mga.financials[mga.financials.length - 1];
              const isAcquired = mga.status === 'Acquired';

              return (
                <div
                  key={mga.id}
                  onClick={() => toggleMGA(mga.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? isAcquired
                        ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-md'
                        : 'bg-sky-950/40 border-sky-500/60 ring-1 ring-sky-500/30 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {mga.code}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">{mga.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {mga.primary_lob} • {mga.years_of_experience} Yrs Exp
                    </div>
                    <div className="flex items-center gap-3 text-xs pt-1">
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(latestFin?.historical_ebitda || 0, true)} EBITDA
                      </span>
                      <span className="text-slate-400 font-mono">
                        +{latestFin?.yoy_ebitda_growth_pct}% YoY
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 mt-1">
                    {isSelected ? (
                      <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                        ✓
                      </span>
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 flex items-center justify-center font-bold text-xs">
                        +
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Controls & Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-slate-800">
              Simulation Levers
            </h3>

            {/* Synergy Realization Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                <span>Synergy Realization Rate</span>
                <span className="font-mono text-amber-400 font-bold">{synergyRealizationPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={synergyRealizationPct}
                onChange={(e) => setSynergyRealizationPct(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0% (Conservative)</span>
                <span>100% (Full Potential)</span>
              </div>
            </div>

            {/* PE Exit Multiple Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                <span>PE Exit Valuation Multiple</span>
                <span className="font-mono text-sky-400 font-bold">{exitMultiple}x EBITDA</span>
              </div>
              <input
                type="range"
                min="8"
                max="16"
                step="0.5"
                value={exitMultiple}
                onChange={(e) => setExitMultiple(Number(e.target.value))}
                className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>8.0x</span>
                <span>12.0x (Market)</span>
                <span>16.0x</span>
              </div>
            </div>
          </div>

          {/* Chart Preview */}
          <div className="pt-4 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Standalone vs Synergy Expansion ($M EBITDA)
            </span>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simulationChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="M" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}M`, '']}
                  />
                  <Bar dataKey="ebitda" name="Core EBITDA" stackId="a" fill="#0ea5e9" />
                  <Bar dataKey="synergy" name="Platform Synergy" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
