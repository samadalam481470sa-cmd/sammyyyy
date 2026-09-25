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
  /** Modules scheduled for later sprints render a placeholder page. */
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
    available: false,
    description:
      'The full opportunity register with profiles, financials, status and stage history.',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    path: '/relationships',
    icon: Users,
    available: false,
    description: 'Principals, management teams and contacts connected to each opportunity.',
  },
  {
    id: 'tasks',
    label: 'Tasks & Follow-Ups',
    path: '/tasks',
    icon: ListChecks,
    available: false,
    description: 'Every A / B / C next action across the deal team in one working list.',
  },
  {
    id: 'sources',
    label: 'Sources / Bankers',
    path: '/sources',
    icon: Landmark,
    available: false,
    description: 'Deal origination by investment banker, intermediary and direct relationship.',
  },
  {
    id: 'carriers',
    label: 'Carriers / Reinsurers',
    path: '/carriers',
    icon: ShieldCheck,
    available: false,
    description: 'Capacity partners, paper relationships and reinsurance support.',
  },
  {
    id: 'portfolio',
    label: 'Portfolio Companies',
    path: '/portfolio',
    icon: Building2,
    available: false,
    description: 'Completed acquisitions, integration status and post-close performance.',
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: FileText,
    available: false,
    description: 'NDAs, IOIs, LOIs and diligence materials stored against each project.',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: ChartColumn,
    available: false,
    description: 'Pipeline, origination and portfolio reporting for the investment committee.',
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    available: false,
    description: 'Users, permissions and the pick-list values used across the CRM.',
  },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];
