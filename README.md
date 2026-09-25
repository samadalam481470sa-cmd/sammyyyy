# Newport Specialty Partners — Acquisition & Strategic Growth CRM

An internal M&A / acquisition deal-management application for Newport Specialty Partners, an
insurance-focused acquirer of Managing General Agents (MGAs). This is **not** a traditional
sales CRM — it centralizes visibility into Newport's acquisition pipeline: which deals exist,
where they stand in the acquisition process, who owns them, and what needs attention.

This sprint delivers the **application shell** (sidebar navigation + top-level layout) and a
fully functional **Dashboard** module. Every other navigation item (Opportunities,
Relationships, Tasks & Follow-Ups, Sources / Bankers, Carriers / Reinsurers, Portfolio
Companies, Documents, Reports, Settings) is wired to a placeholder page so those modules can be
built out in future sprints without restructuring the app.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Lucide React (icons)
- Recharts (charts)

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to `http://localhost:5173`).

Other scripts:

```bash
npm run build    # type-check + production build
npm run lint     # oxlint
npm run preview  # preview the production build
```

## Project structure

```
src/
  types/opportunity.ts     Core data model (Opportunity, PriorityTask, ActivityItem, pick-lists)
  data/
    constants.ts            Centralized stage/status/priority configuration (single source of truth)
    navigation.ts            Sidebar navigation structure
    currentUser.ts            Placeholder "logged in" user
    mockOpportunities.ts       Demo acquisition opportunities (fictional data only)
    mockTasks.ts                Demo "This Week's Priorities" tasks
    mockActivity.ts               Demo "Recent Activity" feed
  hooks/
    useOpportunities.ts         Data-access hook (swap for a real API later)
    usePriorityTasks.ts
    useRecentActivity.ts
    useDashboardFilters.ts       Centralized status/stage/search/attention filtering logic
  lib/
    attention.ts                 "Needs Attention" business rules, derived from real fields
    kpis.ts                        Executive KPI calculations
    sort.ts, format.ts, dateUtils.ts, greeting.ts   Presentation helpers
  components/
    layout/                        AppShell, Sidebar, TopHeader
    dashboard/                     KPICard, PipelineOverview, PriorityDealsTable, PriorityTasks,
                                    AttentionAlerts, DashboardCharts, RecentActivity, QuickActions,
                                    NewportAI, OpportunityDrawer, StatusFilter
    common/                        Modal, StatusBadge, StageBadge, PriorityBadge
  pages/
    Dashboard.tsx                   The Dashboard module
    PlaceholderPage.tsx              "Coming soon" page for not-yet-built modules
```

## Data model notes

- **Status** and **Stage** are intentionally separate concepts. `status` is the broad lifecycle
  condition of an opportunity (Active, Pending, Inactive, Closed, Declined, Withdrew,
  Completed). `stage` is where the deal sits within Newport's acquisition process (Target
  Identified → ... → Closing). An Active opportunity can be in any stage.
- All opportunity, task, and activity data in `src/data/*` is fictional demo data, shaped
  exactly like the types future API responses will use, so swapping in a real backend later
  only requires changing the `src/hooks/*` implementations.
- "Needs Attention" is computed dynamically from real fields (`src/lib/attention.ts`) — no
  status is hard-coded as "needs attention"; the count updates automatically as the underlying
  data changes.
