/**
 * Left-navigation structure for the application shell.
 *
 * Only the Dashboard module is functional this sprint. Every other entry is
 * wired to a placeholder route so the information architecture is in place
 * before the corresponding module is built out in a future sprint.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ListChecks,
  Landmark,
  ShieldCheck,
  Building2,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Placeholder items render normally but link to a "coming soon" page. */
  isPlaceholder?: boolean;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'opportunities', label: 'Opportunities', path: '/opportunities', icon: Briefcase, isPlaceholder: true },
  { id: 'relationships', label: 'Relationships', path: '/relationships', icon: Users, isPlaceholder: true },
  { id: 'tasks', label: 'Tasks & Follow-Ups', path: '/tasks', icon: ListChecks, isPlaceholder: true },
  { id: 'sources', label: 'Sources / Bankers', path: '/sources', icon: Landmark, isPlaceholder: true },
  { id: 'carriers', label: 'Carriers / Reinsurers', path: '/carriers', icon: ShieldCheck, isPlaceholder: true },
  { id: 'portfolio', label: 'Portfolio Companies', path: '/portfolio', icon: Building2, isPlaceholder: true },
  { id: 'documents', label: 'Documents', path: '/documents', icon: FileText, isPlaceholder: true },
  { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, isPlaceholder: true },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, isPlaceholder: true },
];
