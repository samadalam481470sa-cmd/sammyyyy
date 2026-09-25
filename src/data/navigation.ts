import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  Settings,
  Users,
} from "lucide-react"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  description: string
  implemented?: boolean
}

export const MAIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
    description: "Acquisition pipeline, priorities, and items that need attention.",
    implemented: true,
  },
  {
    label: "Opportunities",
    to: "/opportunities",
    icon: Briefcase,
    description: "Opportunity profiles, financial detail, and stage history will live here in a later sprint.",
  },
  {
    label: "Relationships",
    to: "/relationships",
    icon: Users,
    description: "Contacts at targets, banks, and carriers will be managed here in a later sprint.",
  },
  {
    label: "Tasks & Follow-Ups",
    to: "/tasks",
    icon: ListChecks,
    description: "The full task board will be added in a later sprint. This week's priorities remain on the dashboard.",
  },
  {
    label: "Sources / Bankers",
    to: "/sources",
    icon: Landmark,
    description: "Banker and intermediary coverage will be added in a later sprint.",
  },
  {
    label: "Carriers / Reinsurers",
    to: "/carriers",
    icon: Building2,
    description: "Carrier and reinsurer relationships will be added in a later sprint.",
  },
  {
    label: "Portfolio Companies",
    to: "/portfolio",
    icon: Library,
    description: "Owned MGAs and portfolio reporting will be added in a later sprint.",
  },
  {
    label: "Documents",
    to: "/documents",
    icon: FileText,
    description: "Deal documents and the data room index will be added in a later sprint.",
  },
  {
    label: "Reports",
    to: "/reports",
    icon: BarChart3,
    description: "Pipeline reporting exports will be added in a later sprint.",
  },
]

export const SETTINGS_NAV: NavItem = {
  label: "Settings",
  to: "/settings",
  icon: Settings,
  description: "Pick lists, team access, and workspace settings will be added in a later sprint.",
}
