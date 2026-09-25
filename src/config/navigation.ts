import {
  BarChart3,
  Building2,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Settings,
  Shield,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Application modules. Only the Dashboard is implemented in this sprint;
 * the rest route to placeholder pages so the shell is ready for future modules.
 */
export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  implemented: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, implemented: true },
  { id: 'opportunities', label: 'Opportunities', icon: Target, implemented: false },
  { id: 'relationships', label: 'Relationships', icon: Users, implemented: false },
  { id: 'tasks', label: 'Tasks & Follow-Ups', icon: ListChecks, implemented: false },
  { id: 'sources', label: 'Sources / Bankers', icon: Landmark, implemented: false },
  { id: 'carriers', label: 'Carriers / Reinsurers', icon: Shield, implemented: false },
  { id: 'portfolio', label: 'Portfolio Companies', icon: Building2, implemented: false },
  { id: 'documents', label: 'Documents', icon: FileText, implemented: false },
  { id: 'reports', label: 'Reports', icon: BarChart3, implemented: false },
]

export const SETTINGS_NAV_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  implemented: false,
}

export type PageId = string
