# Newport CRM — Nov 6, 2026 sprint: what changed

This sprint follows `Newport_Cursor_Prompt_2` (Nov 4, 2026). It is an incremental change to the working CRM. Outlook mail and calendar, Microsoft sign-in, the shared workspace server and the Gemini summary service were kept.

## Shared UI

- `src/components/shared/Overlay.tsx` holds the new shells. `SideDrawer` is the full-height right drawer for editing. `CenteredModal` is the centered white dialog for creating. Both dim and blur the page. Both close with X, Escape or a backdrop click, and the editor inside checks for unsaved changes. `DrawerHeader` is the navy header. `InitialsAvatar` shows "?" when nobody is assigned.
- `CreationDrawer` now renders a centered modal, so New Task, New Relationship and the other create flows all use the same shell.
- `src/components/shared/PageChrome.tsx` holds the page parts: gray workspace, two-row header, white rounded card, search box, segments, record count and filter popover.
- `src/hooks/useSessionState.ts` remembers filters, page numbers and the open drawer for this browser tab. Back from a Full Opportunity Profile returns to the same page, filters, drawer and Dashboard scroll position.
- The sidebar and login page show the real Newport logo. `src/assets/newport-logo-centered.png` is a centered crop of the existing logo, not a new design. Clicking the sidebar logo opens the Dashboard.
- Every main page except the Dashboard fits the window with no outer scroll. Tables and card grids size their pages to the space available. This was checked at 1440×900 and 1280×720.

## Meetings

- The page now has three columns. Left: My Outlook Calendar above Upcoming Meetings. Center: the selected meeting above Meeting History. Right: Transcript, AI Summary and Actions.
- On load, no day is selected. Calendar dots show up to 3 meetings plus "+N". Clicking a day filters the list, and the X on the day chip clears it. View All opens a right drawer with every upcoming event.
- Meeting details show the Outlook title, an optional CRM-only title, the platform (taken from the link), organizer, Linked Opportunity, Linked Contacts and Participants. Contacts are matched only by an exact email address. Participants are never added to Relationships automatically.
- Open and Copy Meeting Link appear when a link exists. Otherwise an Add Meeting Link field appears. Teams, Zoom, Google Meet and any other https link are accepted.
- Add Meeting records a PAST acquisition meeting in a centered modal. The fields are: title, linked opportunity (required), contacts with an optional primary, date and time with time zone, transcript, recording URL and notes. It never creates or sends an Outlook event. Email › Calendar › New Event is unchanged.
- Meeting history is private to each user. Records and transcripts stay in this browser under the user's account key. They are no longer pushed to the shared workspace. Older server copies in the `meetings` collection are left as they are; they are neither pulled nor deleted.
- Uploading a transcript runs the existing Gemini summary on the Newport server. The server prompt now asks for an overview scaled to the transcript, key decisions, outstanding questions, next steps, and follow-ups with the owner and timing exactly as the transcript states them (`server/services/meetingSummary.ts`). The change is backward compatible. Create Task opens the centered New Task modal, filled in with the project, the action and any owner the transcript names. A stated timing is shown as a suggestion only.
- `/meetings/history` is a table page with date, project and search filters. Clicking a row opens a navy drawer with details, transcript, summary and actions.

## Dashboard

- Deals Requiring Action, This Week's Priorities and Needs Attention all open the same read-only navy drawer. Its View Full Opportunity Profile button returns to the Dashboard with the drawer open.
- Needs Attention covers Active/Pending deals only, one row per deal. The order is: most days overdue, then no unfinished task, then no deal lead, then due within 7 days (`attentionRows` in `src/lib/attention.ts`).
- This Week's Priorities shows up to 6 tasks under the same rules as Tasks & Follow-Ups. Overdue tasks show "N days overdue". Priority chips are soft: A red, B amber, C blue.
- Recent Activity shows 4 entries. View All opens a drawer with a date filter (default last 30 days) and Archive / Restore. Archiving only hides an entry from the feed (`src/lib/activityArchive.ts`). The activity record and the Security change history are never changed.

## Opportunities, Tasks, Relationships, Documents, Profile

- Opportunities has a two-row header and 10 columns: Deal ID, Project, Company, Status, Stage, Deal Lead (avatar), NWP, PF EBITDA, Next Action, Due Date. The edit drawer has a navy summary header. The Diligence tab was removed, and its two unique fields (outstanding items and diligence notes) moved to the Company tab.
- Completed now means legally closed. Setting it asks for the legal closing date and sets the stage to Closing. This applies in the drawer, on the profile and in the create form.
- Tasks: the working list shows unfinished tasks on Active/Pending deals only (`isWorkingTask`). Tasks on Inactive, Closed, Declined, Withdrew or Completed deals are paused. They stay on the profile marked Paused and come back unchanged when the deal is Active or Pending again. A standalone task with no deal stays in the list. Status can be edited inline. The task drawer field order is Status, Action, Project, Company, Due Date, Priority, Owner, Notes.
- Task History: the drawer shows the last 30 days and has View All, which opens the new `/tasks/history` page. History lists Completed, Archived and Cancelled/Deleted tasks with their original due dates.
- Relationships shows three cards per row with soft status chips. The edit drawer field order is Name, Company, Title, Linked Projects, Email, Phone, Category, Status, Last Contact, Notes.
- Documents shows three cards per row with six slot icons (with full names on hover). The drawer shows the six slots in one row. Add New Document opens a centered modal. A deleted custom document stays deleted after reload.
- Full Profile: Status and Stage selectors appear on every tab. The header shows Created, Updated and Legally closed dates. The tabs are Overview, Tasks, Relationships, Documents, Meetings, Activity. The Meetings tab shows only your own meetings for that deal.

## Reports and the 24-hour rule

- New fields on an opportunity: `closedAt` (legal closing date), `completionConfirmedAt`, `closingSnapshot` (NWP and PF EBITDA at closing), `completionCorrections` (every confirmation and reversal) and `seedDates`.
- Completion figures count a deal only 24 hours after its completion was confirmed, and they use the legal closing date. This is worked out from saved timestamps each time a report is viewed, so no timer is needed. A reversal removes the deal from completion reports, so nothing is counted twice. Reports label deals that are still provisional. Dashboard and Opportunities show the new status right away.
- Each report tab shows 2 large charts per view, with arrows and dots. Switching tabs resets the period to All Time. A Clear filter button sits beside the period picker. Period filters now apply to every chart.
- The 42 original fictional deals had no dates. They now get fixed demo creation and closing dates, marked `seedDates`. Real dates are never overwritten (`backfillSeedDates`). Fifteen fictional task due dates were moved once to give a mix of overdue, due today, next 7 days and later. The move applies only to tasks that still hold the old seed date (`applyTaskDataFixes`).

## Email, Security, Settings

- The Gmail connect buttons are hidden (`GMAIL_UI_ENABLED = false`). The Outlook auth, Graph permissions and mail and calendar code are unchanged.
- Security change history sits in a fixed area with pagination and is labeled as a protected record.
- The Settings note "this device keeps its own database" is unchanged.

## What is browser-local and what is live

- Browser-local: meeting history and transcripts (private, per account), the activity-feed archive, view state, and every record when no shared server is configured.
- Shared through the existing workspace server when `public/api.json` names it: opportunities, tasks, documents, contacts, activity and custom document types.
- Live third-party services: Microsoft Entra sign-in, Outlook mail and calendar through Microsoft Graph, and Google Gemini summaries through the Newport server. Summaries run only when the shared server is connected and the admin has enabled them.
- No cross-device sync was added for private meetings. This is the separate future backend sprint.

## Tests

- `npm test`: 242 tests pass. The only failure is the MongoDB memory-server suite, which cannot download its binary in this sandbox. New tests are in `src/lib/sprintNov.test.ts`, and `reports.test.ts` was updated.
- A browser walk-through (Playwright, dev server, fictional data) passed these checks: no outer scroll on every main page at both sizes; drawer, profile and Back restoring the page and drawer; the Completed confirmation and the provisional note in Reports; tab switch resetting the period; a paused task leaving Tasks and coming back; saving a past Outlook event to history; Add Meeting with no Outlook invite; Meeting History drawer; profile Meetings tab; a custom document deletion surviving reload; the Dashboard drawer in all three sections with Back; activity archive; and the logo opening the Dashboard.
- Not tested here (it needs a real Microsoft or Gemini session): live Outlook send and receive, New Event creation, and a live Gemini summary through the updated server prompt. Pushing to `main` redeploys the Azure API with the new prompt.
