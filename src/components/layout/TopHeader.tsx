import { useState } from 'react';
import { Bell, Plus, Search } from 'lucide-react';
import { CURRENT_USER } from '../../data/currentUser';
import { getTimeOfDayGreeting } from '../../lib/greeting';
import Modal from '../common/Modal';

interface TopHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onNewOpportunity: () => void;
}

const MOCK_NOTIFICATIONS = [
  { id: 1, text: 'Next action overdue on Project Beacon', time: '1h ago' },
  { id: 2, text: 'Project Summit LOI is awaiting signature', time: '4h ago' },
  { id: 3, text: 'No activity on Project Sentinel in 30+ days', time: 'Yesterday' },
];

export default function TopHeader({ search, onSearchChange, onNewOpportunity }: TopHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-4 px-6 py-4 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">
            {getTimeOfDayGreeting()}, {CURRENT_USER.firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Here&apos;s what&apos;s happening across Newport&apos;s acquisition pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects, companies, contacts..."
              className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:w-72 focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-100 lg:w-64 lg:focus:w-80"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                setProfileOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-800"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
            </button>
            {notificationsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotificationsOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Notifications
                  </p>
                  {MOCK_NOTIFICATIONS.map((n) => (
                    <div key={n.id} className="rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                      <p className="text-slate-700">{n.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{n.time}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotificationsOpen(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white ring-2 ring-white transition-transform hover:scale-105"
              aria-label="User menu"
            >
              {CURRENT_USER.initials}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <p className="text-sm font-medium text-navy-900">{CURRENT_USER.fullName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{CURRENT_USER.role}</p>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onNewOpportunity}
            className="flex items-center gap-1.5 rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-navy-800"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">New Opportunity</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function NewOpportunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New Opportunity" icon={<Plus size={18} />}>
      The full opportunity intake workflow will be available in a future sprint. For now, new acquisition
      opportunities can be tracked manually and added to the pipeline by the deal team.
    </Modal>
  );
}
