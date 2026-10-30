# Sprint Oct 30, 2026 — acceptance checklist

Plan: `docs/Newport_CRM_Consolidated_Sprint_Oct30_2026.txt`. Built in small commits on `main`
(53e469a P1 · 95c436a P2 · 179bf30 P3 · 537ebc8 P4 · 91d70c2 P5 · fc492dc P6 · 2e95fa7 P7 · 800905b P8).
Every push deployed: GitHub Pages and the Azure server workflow both succeeded; the live
`index.html` serves the same bundle as a local `npm run build:desktop`.

How it was checked: `tsc -b`, `oxlint` (0 errors), `vitest` (216 passed in America/Chicago, UTC,
Asia/Tokyo and Pacific/Honolulu), production build, and a headless Chromium session against the
dev server at 1440×900, 1440×1250 and 390×844. The browser session had **no Microsoft sign-in**, so
anything that needs a live Outlook mailbox or calendar is marked NOT VERIFIED.

`server/db/mongo.test.ts` cannot run here (its MongoDB download is blocked by this workspace's
network). It is unrelated to this sprint.

## Results

| # | Item | Result |
| --- | --- | --- |
| P1-A | Deleted records (incl. custom documents) no longer return after reload; seeds added once per user | PASS — seed ledger + tests; browser: deleted Financials stayed gone after 3 reloads |
| P1-A | Existing browsers keep their earlier deletions and edits | PASS — test with pre-ledger storage |
| P1-B | 20 new fictional deals (Project AQ–BJ), 20 linked tasks, 21 contacts; no renumbering; collision-safe names and deal numbers | PASS — tests |
| P1-B | Valid status/stage pairs on new data; Completed at Closing | PASS. 4 older deals (Project Q, X, AE, AL) are Completed but not at Closing: **flagged on the profile, not changed**. New saves cannot set Completed outside Closing |
| P1-C | Date spread around Oct 30 (early/mid/late Oct overdue, today, Nov 1–6, later, 2027) | PASS — test |
| P1-C | Real created / completed timestamps; no invented history | PASS. The 42 older deals have no recorded creation date; Reports says so |
| P1-D | Reproducible consistency audit | PASS — `lib/consistencyAudit.ts`, tests, `window.__newportAudit()` in dev. Oct 30: 62 deals, 20 overdue tasks, 25 deals need attention (15 overdue, 5 missing task, 5 due within 7 days) |
| Rules 1–3 | Needs Attention only for Active/Pending, from linked tasks; red overdue / red missing / navy ≤7 days; unique-deal counts; canonical next action (earliest due, A/B/C, ID) | PASS — tests incl. Oct 30, Nov 1, Nov 6, Nov 7 and local midnight |
| Rule 5 | Local calendar day, no UTC off-by-one; works after Oct 30 | PASS — tests in four time zones |
| P2-A | Opportunities, Tasks, Relationships, Meeting History: fitted pagination, accurate "Showing X–Y of Z", no outer page scroll | PASS — browser (no document scroll at 1440×900 and 390×844) |
| P2-B | Documents grid and Security history paginated | PASS |
| P2-C | Dashboard View all opens target at top, page 1, filter kept | PASS |
| P2-D/E/F | Removable chips (stage, owner, status, Needs Attention, project, task owner, search) + Clear All; Tasks Project/Owner filter; sort overdue-first A/B/C then date/ID | PASS |
| P2-G | Profile: header stays, panels scroll inside, Save/Delete on screen; profile Documents panel has no X | PASS — browser |
| P2-H | Documents: Add New Document opens full-height dimmed drawer, actions at bottom, unsaved guard | PASS — browser |
| P3-A | Bell overdue count = Tasks > Overdue (20 = 20); five most urgent; View all opens Overdue | PASS — browser + test |
| P3-B | Bell shows five newest real unread emails; View all opens Inbox › Unread; truthful states | Code PASS; live mailbox NOT VERIFIED |
| P3-C | Recent Activity shows four newest | PASS |
| P3-D | Dashboard lists read saved tasks and canonical rules | PASS — audit tests |
| P3-E | Newport AI: successive questions, exact project (A vs B), unknown project, no wrong-project answers | PASS — browser + tests. No AI service is connected on the static site, so answers are labelled "from current CRM records" |
| P4 | Custom document deletion on Documents and profile; core slot file removal clears metadata and keeps the slot; ID links; driving task marked on profile | PASS — browser + tests |
| P5-A | Existing mail client unchanged | Code paths unchanged; mail tests pass; live mailbox NOT VERIFIED |
| P5-B | Sender display name with address fallback | PASS (Outlook and Gmail parsing). Photos are **not** fetched (would need an extra Graph permission); initials avatars are shown |
| P5-C | Email › Calendar (month/week/day, details, New Event, consent and error states, nothing saved unless Graph confirms) | UI PASS — browser; Graph read/create PASS with mocked Graph; **live Outlook NOT VERIFIED** |
| P6 | Six KPIs on one row; three tabs; per-tab period filter; 4/4/3 charts; recorded dates only; reversals; missed deadlines from original due date; exports follow tab and period | PASS — tests + browser. Export files not opened in this session (NOT VERIFIED) |
| P7-A | Calling features removed (soft phone, camera room, huddle, captions, recording controls) | PASS |
| P7-B/C | Calendar dots (+N), upcoming list, Add Meeting drawer, CRM-only title, organizer/invitees, links, project and contact linking | UI PASS with cached sample events; live Outlook NOT VERIFIED |
| P7-D/G | Private meeting history, widget + View All page, filters, pagination, row actions, 3-tab pane | PASS — browser |
| P7-E | Transcript upload (TXT/VTT/DOCX), automatic summary, honest unavailable/retry | Upload PASS (browser VTT, unit DOCX). Summary **BLOCKED** — no approved AI service yet; app shows "Summary unavailable" and keeps the transcript |
| P7-E | Create Task from a proposed action | NOT VERIFIED in browser (needs a summary); uses the standard New Task drawer prefilled, due in 7 days |
| P7-F | Recording link only, Open Recording | PASS |
| P7-H | No claims of automatic Teams recording; transcripts not in static assets; requirements documented | PASS — `docs/MEETINGS_AI_AND_STORAGE.md` |

## Blocked by outside permissions or decisions

1. **AI meeting summaries.** Off until an administrator sets `MEETING_SUMMARY_ENABLED=1` and
   `OPENAI_API_KEY` on the Azure App Service, after Newport approves the provider and its data terms.
2. **Calendar in work tenants.** A Microsoft 365 admin may need to approve `Calendars.ReadWrite`
   for the app. Personal Microsoft accounts may be refused Teams links; the app shows Microsoft's reason.
3. **Shared meeting history and transcripts.** Private to each user on their device by design until
   sponsor permissions are decided.
4. **Sender photos.** Not fetched; would need an additional Graph permission.

## Main changes by area

- Data: `lib/seedLedger.ts`, `data/sprintSeedV2.ts`, `lib/statusHistory.ts`, `lib/attention.ts`,
  `lib/nextAction.ts`, `lib/consistencyAudit.ts`, `data/DataContext.tsx`.
- Lists: `lib/paginate.ts`, `hooks/useFitRows.ts`, `components/shared/Pagination.tsx`,
  `components/shared/FilterChips.tsx`, the Opportunities, Tasks, Relationships, Documents,
  Security and profile pages.
- Bell, Dashboard, AI: `components/layout/MailNotificationsPanel.tsx`, `lib/aiAssistant.ts`,
  `components/dashboard/NewportAI.tsx`.
- Calendar: `lib/graphCalendar.ts`, `lib/calendarStore.ts`, `hooks/useOutlookCalendar.ts`,
  `components/email/EmailCalendar.tsx`; Outlook sync and reminders now read the one store.
- Reports: `lib/reports.ts`, `pages/ReportsPage.tsx`.
- Meetings: `pages/MeetingsPage.tsx`, `pages/MeetingHistoryPage.tsx`,
  `components/meetings/*`, `hooks/useCrmMeetings.ts`, `lib/crmMeetings.ts`, `lib/transcript.ts`,
  `server/services/meetingSummary.ts`, `server/routes/workspace.ts`.
