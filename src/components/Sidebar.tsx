import React from 'react';
import { cn } from '../lib/utils';
import { 
  Building2, 
  Layers, 
  GitPullRequest, 
  Database, 
  Store, 
  SlidersHorizontal,
  Briefcase,
  ShieldCheck,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pipelineCount: number;
  acquiredCount: number;
  synergyCount: number;
  jakesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pipelineCount,
  acquiredCount,
  synergyCount,
  jakesCount,
}) => {
  const navItems = [
    {
      id: 'pipeline',
      label: 'M&A Pipeline',
      description: 'Prospect screening & diligence',
      icon: GitPullRequest,
      badge: pipelineCount,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'portfolio',
      label: 'Aggregated Portfolio',
      description: 'The "One Platform" Synergies',
      icon: Layers,
      badge: `${acquiredCount} MGAs`,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      highlight: true,
    },
    {
      id: 'synergies',
      label: 'Synergy Engine',
      description: 'Overlaps & carrier capacity',
      icon: Sparkles,
      badge: `${synergyCount} Ops`,
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    },
    {
      id: 'jakes',
      label: 'Retail Agencies ("The Jakes")',
      description: 'Independent broker network',
      icon: Store,
      badge: jakesCount,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'simulator',
      label: 'M&A Roll-Up Simulator',
      description: 'What-if acquisition modeling',
      icon: SlidersHorizontal,
    },
    {
      id: 'schema',
      label: 'Database Schema & ERD',
      description: 'Architecture & Mary requirements',
      icon: Database,
    },
  ];

  return (
    <aside className="w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">NEWPORT</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">MGA</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Specialty Partners Platform</p>
          </div>
        </div>

        <div className="mt-4 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-medium text-slate-300">Sponsor: Lovell Minnick</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
            Active Roll-Up
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Core Workspaces
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group relative',
                isActive
                  ? 'bg-sky-600 text-white font-medium shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              )}
            >
              <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                        isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={cn('text-xs truncate mt-0.5', isActive ? 'text-sky-100' : 'text-slate-400')}>
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Info / Mary Call Banner */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="p-3 rounded-lg bg-gradient-to-br from-slate-900 to-sky-950/50 border border-sky-800/40">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              7:00 PM Call Ready
            </span>
            <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded border border-sky-800 font-mono">v1.2 MVP</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Prepared for Mary & PE Leadership: MGA schema, EBITDA YoY trends & Synergy overlap engine.
          </p>
        </div>
      </div>
    </aside>
  );
};
