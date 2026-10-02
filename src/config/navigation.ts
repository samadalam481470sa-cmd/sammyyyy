import {
  Briefcase,
  Building2,
  ChartColumn,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** All modules are interactive in the unlocked CRM build. */
  available: boolean;
  description: string;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    available: true,
    description: 'Pipeline, priorities and activity across Newport acquisitions.',
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    path: '/opportunities',
    icon: Briefcase,
    available: true,
    description: 'Full opportunity register with financials, status and stage.',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    path: '/relationships',
    icon: Users,
    available: true,
    description: 'Principals, bankers, intermediaries and carrier contacts.',
  },
  {
    id: 'tasks',
    label: 'Tasks & Follow-Ups',
    path: '/tasks',
    icon: ListChecks,
    available: true,
    description: 'Every A / B / C next action across the deal team.',
  },
  {
    id: 'sources',
    label: 'Sources / Bankers',
    path: '/sources',
    icon: Landmark,
    available: true,
    description: 'Deal origination by banker, intermediary and direct channel.',
  },
  {
    id: 'carriers',
    label: 'Carriers / Reinsurers',
    path: '/carriers',
    icon: ShieldCheck,
    available: true,
    description: 'Capacity partners, paper relationships and reinsurance support.',
  },
  {
    id: 'portfolio',
    label: 'Portfolio Companies',
    path: '/portfolio',
    icon: Building2,
    available: true,
    description: 'Closed and completed acquisitions with post-close context.',
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: FileText,
    available: true,
    description: 'NDAs, IOIs, LOIs and diligence materials by project.',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: ChartColumn,
    available: true,
    description: 'Pipeline and portfolio reporting for the investment committee.',
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    available: true,
    description: 'Team roster and the pick-list values used across the CRM.',
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];
