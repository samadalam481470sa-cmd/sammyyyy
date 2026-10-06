import React, { useEffect, useMemo, useState } from 'react';
import { mockMGAs, mockSynergyOpportunities, mockRetailAgencies } from './data/mockData';
import { MGA, SynergyOpportunity, RetailAgency } from './types';
import { Sidebar } from './components/Sidebar';
import { PipelineDashboard } from './components/PipelineDashboard';
import { PortfolioView } from './components/PortfolioView';
import { MGADetailModal } from './components/MGADetailModal';
import { SchemaArchitectureView } from './components/SchemaArchitectureView';
import { RetailAgenciesView } from './components/RetailAgenciesView';
import { RollupSimulator } from './components/RollupSimulator';
import { AddMGAModal } from './components/AddMGAModal';
import { InteractiveDatabase } from './components/InteractiveDatabase';
import { 
  Database, 
  CheckCircle2,
  Menu,
  GitPullRequest,
  Layers,
  Store,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

function usePhoneMode(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('phone') === '1' || params.get('layout') === 'phone' || window.location.hash === '#phone';
    setPhone(forced);
  }, []);
  return phone;
}

export const App: React.FC = () => {
  const forcePhone = usePhoneMode();
  const [currentTab, setCurrentTab] = useState<string>('database');
  const [mgas, setMGAs] = useState<MGA[]>(mockMGAs);
  const [synergies] = useState<SynergyOpportunity[]>(mockSynergyOpportunities);
  const [retailAgencies, setRetailAgencies] = useState<RetailAgency[]>(mockRetailAgencies);
  const [selectedMGA, setSelectedMGA] = useState<MGA | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAcquireMGA = (mgaId: string) => {
    setMGAs(prev => prev.map(m => {
      if (m.id === mgaId) {
        return {
          ...m,
          status: 'Acquired',
          pipeline_stage: 'On-Platform',
          acquired_date: new Date().toISOString().split('T')[0],
        };
      }
      return m;
    }));
    showToast(`Successfully acquired MGA onto Newport Specialty Platform! Synergy engine updated.`);
  };

  const handleAddMGA = (newMGA: MGA) => {
    setMGAs(prev => [newMGA, ...prev]);
    if (newMGA.retail_agencies) {
      setRetailAgencies(prev => [...newMGA.retail_agencies!, ...prev]);
    }
    showToast(`Added ${newMGA.name} to M&A Pipeline.`);
  };

  const pipelineCount = mgas.filter(m => m.status === 'Pipeline').length;
  const acquiredCount = mgas.filter(m => m.status === 'Acquired').length;

  const bottomTabs = useMemo(() => [
    { id: 'database', label: 'Database', icon: Database },
    { id: 'pipeline', label: 'Pipeline', icon: GitPullRequest },
    { id: 'portfolio', label: 'Portfolio', icon: Layers },
    { id: 'jakes', label: 'Jakes', icon: Store },
    { id: 'synergies', label: 'Synergy', icon: Sparkles },
  ], []);

  const shell = (
    <div className={`flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans ${forcePhone ? 'flex-col' : ''}`}>
      {toastMessage && (
        <div className="fixed top-5 right-5 left-5 sm:left-auto z-[60] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pipelineCount={pipelineCount}
        acquiredCount={acquiredCount}
        synergyCount={synergies.length}
        jakesCount={retailAgencies.length}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        forcePhone={forcePhone}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 md:pb-0">
        {/* Mobile / Phone header */}
        <header className={`border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-20 shrink-0 ${forcePhone ? 'flex' : 'flex md:hidden'} items-center justify-between px-3 h-14`}>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-200"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-bold tracking-tight">NEWPORT</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">PHONE</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
            LM
          </div>
        </header>

        {/* Desktop header */}
        {!forcePhone && (
          <header className="hidden md:flex h-16 px-6 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-20 items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                NEWPORT SPECIALTY PARTNERS
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-xs text-slate-400 font-medium truncate">
                {currentTab === 'database' && 'Unified Interactive Portfolio Database'}
                {currentTab === 'pipeline' && 'M&A Corporate Development Pipeline'}
                {currentTab === 'portfolio' && 'Aggregated Platform Portfolio'}
                {currentTab === 'synergies' && 'Synergy & Capacity Consolidation Engine'}
                {currentTab === 'jakes' && 'Retail Brokerages ("The Jakes")'}
                {currentTab === 'simulator' && 'M&A Roll-Up Simulator'}
                {currentTab === 'schema' && 'Database Schema & ERD'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentTab('database')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
              >
                <Database className="h-3.5 w-3.5" />
                Interactive Database
              </button>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white border border-white/20">
                LM
              </div>
            </div>
          </header>
        )}

        <div className={`mx-auto w-full space-y-4 flex-1 ${forcePhone ? 'p-3 max-w-md' : 'p-3 sm:p-6 max-w-7xl'}`}>
          {currentTab === 'database' && (
            <InteractiveDatabase
              mgas={mgas}
              retailAgencies={retailAgencies}
              synergies={synergies}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
            />
          )}
          {currentTab === 'pipeline' && (
            <PipelineDashboard
              mgas={mgas}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
              onAddMGAClick={() => setIsAddModalOpen(true)}
              onAcquireMGA={handleAcquireMGA}
            />
          )}
          {(currentTab === 'portfolio' || currentTab === 'synergies') && (
            <PortfolioView
              mgas={mgas}
              synergies={synergies}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
            />
          )}
          {currentTab === 'jakes' && (
            <RetailAgenciesView
              retailAgencies={retailAgencies}
              mgas={mgas}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
            />
          )}
          {currentTab === 'simulator' && (
            <RollupSimulator
              mgas={mgas}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
            />
          )}
          {currentTab === 'schema' && <SchemaArchitectureView />}
        </div>
      </main>

      {/* Phone bottom navigation */}
      <nav
        className={`${forcePhone ? 'flex' : 'flex md:hidden'} fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]`}
      >
        {bottomTabs.map((tab) => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                active ? 'text-sky-300' : 'text-slate-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-sky-400' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {selectedMGA && (
        <MGADetailModal
          mga={selectedMGA}
          onClose={() => setSelectedMGA(null)}
          onAcquire={handleAcquireMGA}
        />
      )}
      <AddMGAModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMGA={handleAddMGA}
      />
    </div>
  );

  if (forcePhone) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-start justify-center p-0 sm:p-6">
        <div className="w-full sm:w-[390px] sm:h-[844px] sm:rounded-[2rem] sm:border sm:border-slate-700 sm:shadow-2xl sm:overflow-hidden bg-slate-950 relative">
          <div className="hidden sm:flex absolute top-2 left-1/2 -translate-x-1/2 z-50 w-28 h-5 bg-slate-950 rounded-full border border-slate-800" />
          <div className="h-full sm:h-[844px] overflow-hidden">{shell}</div>
        </div>
      </div>
    );
  }

  return <div className="h-screen w-full">{shell}</div>;
};

export default App;
