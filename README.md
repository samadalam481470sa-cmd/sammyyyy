# Newport Specialty Partners — Acquisition & Strategic Growth CRM

An internal M&A / acquisition deal-management application for Newport Specialty Partners,
which evaluates and acquires Managing General Agents (MGAs). This is **not** a sales CRM:
opportunities are entire companies moving through an acquisition process.

## Current sprint scope

Only the **Main Dashboard** is implemented. The application shell (sidebar navigation,
header, search) is in place so future modules (Opportunities, Relationships, Documents,
Diligence, etc.) can be added without restructuring.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- lucide-react (icons)
- Recharts (charts)

## Running locally

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run lint     # oxlint
```

## Architecture notes

- `src/config/picklists.ts` — single source of truth for Status, Stage, Opportunity Type,
  Source Type, and Task Priority pick-lists. **Status** (broad deal condition) and
  **Stage** (position in the acquisition process) are deliberately separate concepts.
  Stage names are preliminary and configurable.
- `src/data/mockData.ts` — fictional demo records only. All financial figures are
  illustrative and do not represent real Newport data.
- `src/data/api.ts` — data-access layer. Components read exclusively through these
  functions, so a real database/API can replace the mock data by changing this module
  alone. It also derives "needs attention" flags (overdue/missing next actions, stalled
  deals, upcoming critical deadlines, unassigned owners) from the raw records.
- `src/lib/filters.ts` — composable dashboard filter state (status, stage, search,
  attention-only).
- `src/components/` — `layout/` (AppShell, Sidebar, TopHeader, PlaceholderPage),
  `dashboard/` (KPI cards, pipeline, deals table, tasks, alerts, charts, activity,
  quick actions, Newport AI, opportunity drawer), and `common/` primitives.
- The Newport AI card is a UI prototype; `submitPrompt` in
  `src/components/dashboard/NewportAI.tsx` is the future backend integration point.
