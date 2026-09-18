import React, { useState } from 'react';
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
import { 
  ShieldCheck, 
  Sparkles, 
  Database, 
  HelpCircle, 
  Layers, 
  GitPullRequest,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('pipeline');
  const [mgas, setMGAs] = useState<MGA[]>(mockMGAs);
  const [synergies, setSynergies] = useState<SynergyOpportunity[]>(mockSynergyOpportunities);
  const [retailAgencies, setRetailAgencies] = useState<RetailAgency[]>(mockRetailAgencies);
  
  const [selectedMGA, setSelectedMGA] = useState<MGA | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Acquire an MGA onto the platform
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

  // Add a new MGA to the pipeline
  const handleAddMGA = (newMGA: MGA) => {
    setMGAs(prev => [newMGA, ...prev]);
    if (newMGA.retail_agencies) {
      setRetailAgencies(prev => [...newMGA.retail_agencies!, ...prev]);
    }
    showToast(`Added ${newMGA.name} to M&A Pipeline.`);
  };

  const pipelineCount = mgas.filter(m => m.status === 'Pipeline').length;
  const acquiredCount = mgas.filter(m => m.status === 'Acquired').length;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pipelineCount={pipelineCount}
        acquiredCount={acquiredCount}
        synergyCount={synergies.length}
        jakesCount={retailAgencies.length}
      />

      {/* Main Central Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Sticky Header */}
        <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              NEWPORT SPECIALTY PARTNERS
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400 font-medium">
              {currentTab === 'pipeline' && 'M&A Corporate Development Pipeline'}
              {currentTab === 'portfolio' && 'Aggregated Platform Portfolio ("The One Platform")'}
              {currentTab === 'synergies' && 'Synergy & Capacity Consolidation Engine'}
              {currentTab === 'jakes' && 'Independent Retail Brokerages ("The Jakes")'}
              {currentTab === 'simulator' && 'M&A Roll-Up & Exit Multiple Simulator'}
              {currentTab === 'schema' && 'Relational Database Architecture & ERD Specification'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('schema')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all"
            >
              <Database className="h-3.5 w-3.5" />
              <span>Mary Call Spec (7:00 PM)</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white border border-white/20">
              LM
            </div>
          </div>
        </header>

        {/* Dynamic View Body */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex-1">
          {currentTab === 'pipeline' && (
            <PipelineDashboard
              mgas={mgas}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
              onAddMGAClick={() => setIsAddModalOpen(true)}
              onAcquireMGA={handleAcquireMGA}
            />
          )}

          {currentTab === 'portfolio' && (
            <PortfolioView
              mgas={mgas}
              synergies={synergies}
              onSelectMGA={(mga) => setSelectedMGA(mga)}
            />
          )}

          {currentTab === 'synergies' && (
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

          {currentTab === 'schema' && (
            <SchemaArchitectureView />
          )}
        </div>
      </main>

      {/* MGA Drilldown Detail Modal */}
      {selectedMGA && (
        <MGADetailModal
          mga={selectedMGA}
          onClose={() => setSelectedMGA(null)}
          onAcquire={handleAcquireMGA}
        />
      )}

      {/* Add Target MGA Modal */}
      <AddMGAModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMGA={handleAddMGA}
      />
    </div>
  );
};
export default App;
