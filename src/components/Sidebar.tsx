import React from 'react';
import { cn } from '../lib/utils';
import { 
  Layers, 
  GitPullRequest, 
  Database, 
  Store, 
  SlidersHorizontal,
  Briefcase,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pipelineCount: number;
  acquiredCount: number;
  synergyCount: number;
  jakesCount: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  forcePhone?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pipelineCount,
  acquiredCount,
  synergyCount,
  jakesCount,
  mobileOpen = false,
  onMobileClose,
  forcePhone = false,
}) => {
  const navItems = [
    {
      id: 'database',
      label: 'Interactive Database',
      description: 'Unified live tables & joins',
      icon: Database,
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
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

  const handleNav = (id: string) => {
    setCurrentTab(id);
    onMobileClose?.();
  };

  const panel = (
    <aside
      className={cn(
        'bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 h-full',
        forcePhone ? 'w-full' : 'w-72',
        !forcePhone && 'hidden md:flex'
      )}
    >
      <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between gap-3">
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
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
              onClick={() => handleNav(item.id)}
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

      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="p-3 rounded-lg bg-gradient-to-br from-slate-900 to-sky-950/50 border border-sky-800/40">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Phone Layout Live
            </span>
            <span className="text-[10px] bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded border border-sky-800 font-mono">v1.3</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Mobile CRM for Mary: pipeline, EBITDA, Jakes & synergies in one thumb-friendly layout.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      {!forcePhone && panel}

      {/* Mobile drawer */}
      {(forcePhone || true) && (
        <div
          className={cn(
            'fixed inset-0 z-50 transition-opacity',
            forcePhone ? '' : 'md:hidden',
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onMobileClose} />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[86%] max-w-sm shadow-2xl transition-transform duration-200',
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="h-full flex md:hidden">
              {/* Force visible panel in drawer */}
              <aside className="w-full bg-slate-900 border-r border-slate-800 flex flex-col h-full">
                <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-500 flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-base text-white">NEWPORT</span>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">MGA</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Phone Menu</p>
                      </div>
                    </div>
                    <button onClick={onMobileClose} className="p-2 rounded-lg bg-slate-800 text-slate-300" aria-label="Close">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all',
                          isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
