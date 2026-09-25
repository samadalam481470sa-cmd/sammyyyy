# Newport Specialty Partners — Acquisition & Strategic Growth CRM

Internal CRM for Newport Specialty Partners' evaluation and acquisition of Managing General
Agents (MGAs). This is an **M&A deal-management system**, not a sales CRM: each record is a
company being evaluated for acquisition, tracked under a confidential project code name.

**Sprint 1 delivers the Dashboard** plus the application shell. The remaining modules
(Opportunities, Relationships, Tasks & Follow-Ups, Sources / Bankers, Carriers / Reinsurers,
Portfolio Companies, Documents, Reports, Settings) appear in the navigation and route to
placeholder pages.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | TypeScript project build (no emit) |
| `npm run lint` | oxlint |
| `npm run preview` | Preview the production build |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · Lucide React · Source Sans 3.

## Project structure

```
src/
  config/        Branding, navigation and every pick list (statuses, stages, types, rules)
  types/         Domain model: Opportunity, OpportunityView, TaskItem, ActivityEvent
  data/          Demo dataset — fictional records only, isolated from application logic
  services/      Data-access seam (dashboardService) and the Newport AI seam (aiAssistant)
  lib/           Derived logic: attention rules, filtering, metrics, formatting
  hooks/         useDashboard, useDashboardData, useDashboardFilters, useToast
  state/         Shared filter state and toast providers
  components/
    layout/      AppShell, Sidebar, TopHeader, Logo
    ui/          Card, Badge, Button, Avatar, Drawer, EmptyState, ToastViewport
    dashboard/   Dashboard, StatusFilter, KPICard, PipelineOverview, PriorityDealsTable,
                 PriorityTasks, AttentionAlerts, DashboardCharts, RecentActivity,
                 QuickActions, NewportAI, OpportunityDrawer
  pages/         ModulePlaceholderPage
```

## Data model

### Status and Stage are separate concepts

- **Status** — the broad condition of an opportunity: Active, Pending, Inactive, Closed,
  Declined, Withdrew, Completed.
- **Stage** — where the deal sits in the acquisition process: Target Identified, Initial
  Outreach, Preliminary Discussion, NDA, Initial Review, IOI / LOI, Exclusivity, Due Diligence,
  Closing.

An Active opportunity therefore has a stage such as NDA or Due Diligence. The two are stored,
filtered and displayed independently throughout the UI.

Stage names are preliminary and expected to change after sponsor feedback. They live in
`src/config/picklists.ts` (`PIPELINE_STAGES`) — renaming or re-ordering that array updates the
pipeline, charts, filters, badges and drawer with no other code changes. The same file owns
statuses, opportunity types, source types, A/B/C priorities and the attention rules.

### Needs Attention is derived, not stored

`src/lib/attention.ts` evaluates each opportunity against configurable rules in
`ATTENTION_RULES`: overdue next action, missing next action, no activity in 30+ days, a critical
date inside 7 days, or no deal lead. Components read the resulting `OpportunityView`, so the
thresholds can be tuned in one place.

## Replacing the demo data

Every component reads data through `fetchDashboardSnapshot()` in
`src/services/dashboardService.ts`, which currently returns the fictional dataset in
`src/data/demoDataset.ts`. Point that function at an API returning a `DashboardSnapshot` and the
UI works unchanged:

```ts
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const response = await fetch('/api/dashboard');
  return response.json();
}
```

Newport AI is a UI prototype. `askNewportAI()` in `src/services/aiAssistant.ts` is the seam for a
future model call; no external AI service is contacted today.

> All companies, people and financial figures in the demo dataset are fictional and do not
> represent Newport Specialty Partners activity.
