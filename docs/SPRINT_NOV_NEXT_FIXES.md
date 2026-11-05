# Newport CRM — Next Fixes and Deal Leads sprint: what changed

This sprint follows `docs/Newport_CRM_Next_Fixes_Plus_Deal_Leads_Nov4_2026.txt`. It is an incremental change. Outlook, Microsoft sign-in and Gemini code were not rewritten.

## Fixes by page

**Dashboard.** Needs Attention has a warm pale-yellow heading. All icons are amber. Only overdue text is red. This Week's Priorities shows up to 7 tasks and fills the card. Import Excel moved to Settings; the quick action is now New Deal Lead, Add Myself as Deal Lead, or Edit My Deal Lead Profile.

**Tasks & Follow-Ups.** One comparator (`compareVisibleTasks`) serves Tasks and Dashboard: warning tier, then A/B/C, then due date. Done stays on the list in green with an X. The X asks "Move this completed task to Task History?". Done tasks auto-archive after seven days. Warning triangles have their own fixed column. The table fills the card.

**Deal status and task lists.** Tasks on Inactive, Closed, Declined and Withdrew deals are paused. Tasks on Active, Pending and Completed deals are listed. This follows the prompt; the previous sprint also paused Completed deals. Needs Attention still covers Active and Pending only.

**Opportunities.** The table fills the card. Stage pills show the full label. The edit drawer has one compact warning chip beside the X, and it opens to show every reason.

**Warning colors.** `dealWarnings` now returns red only for overdue, amber for missing action or lead, and blue (`navy`) for due within seven days.

**Full Opportunity Profile.** The header is rebuilt: identity on the left, status and stage badges and deal lead in their own row. The dropdown pair stays in one place on every deal, and the Needs Attention slot has a fixed size. The tab strip sits lower. The profile opens on the tab that matches where you came from, and highlights the originating task, document or meeting. Documents is a full-width list that opens the right drawer on the exact slot.

**Documents.** Clicking a slot icon on a card opens that exact slot, filled or empty.

**New Task and New Relationship.** Linked Project is required and starred in every entry point, with inline errors. These checks live in the shared editors, so every entry point gets them.

**History filters.** Recent Activity, the Task History drawer and the Task History page have Clear filter. Default is Last 30 Days.

**Recent Activity.** Single archive asks first. Archive All and Restore All act only on the current filtered results and state the exact count. A search box was added because the prompt refers to search filters.

**Search and navigation.** `SearchBox` is one text input with one X. `useSessionState` holds the navigation policy: a fresh arrival resets to defaults, and a return (a child view's Back, or browser Back) restores.

**Meetings.** Back from Meeting History restores the day and meeting. The history drawer has two tabs: Meeting Details and Transcript & AI, with the three existing subtabs.

**Reports.** The donut fits its card, its count is centered, colors match status badges, and the hover reads "Active · 10 deals · 23.3%". Trends has two views with two stepped charts each. Cumulative charts step on legal closing dates. Monthly charts are not cumulative and can fall to zero.

**Sidebar logo.** `newport-logo-light.png` and `newport-compass-light.png` are made from the existing logo artwork: the background is removed, black ink becomes white and blue ink becomes light blue. No new artwork was drawn. The sign-in page is unchanged. Clicking the logo returns to the Dashboard and resets its filters without a reload.

**Settings.** Excel Import is a separate section using the existing importer (`ExcelImportAction`). The backup controls are relabeled.

## Deal Leads

- Roster record: `src/lib/dealLeads.ts`. Page: `src/pages/DealLeadsPage.tsx`. Editor: `src/components/dealLeads/`.
- An opportunity stores `primaryLeadId` and `additionalLeadIds`. `dealLead` stays as the primary's display name, so older screens, exports and every report keep working and count a deal once, under its primary lead.
- Upgrade: a name that exactly matches the roster becomes the primary. Any other name, such as Alex Rivera, stays visible as a legacy value to review. Nothing is erased and no lead is created from it.
- The roster starts with Mary Sbaschnig and Dennis DiCapua, with no invented contact details.
- A person whose verified name matches an unlinked roster record claims it through Add Myself, which prevents a duplicate.

## The shared server: differs from the prompt

The prompt assumes there is no shared backend. The live site does have one: the Azure workspace server already shares opportunities, tasks, documents, contacts and activity. Opportunities would point at lead ids that other people could not resolve if the roster stayed in one browser. So the roster uses that same existing sync, as one new collection name (`dealLeads`) in `server/routes/workspace.ts`. No new backend, table or sign-in flow was added.

Until the Azure deploy finishes, saves wait and retry. The app shows "Not saved to the server yet" during that window.

## Permissions: what is and is not enforced

- Admin means the role the server returned at sign-in (from `ADMIN_EMAILS`), or the manager session. No admin is invented.
- Regular users can add or edit only their own profile. They see other profiles read-only.
- The server also enforces this for roster records in the shared workspace. See `docs/SECURITY_DEFENSES.md`.
- If `ADMIN_EMAILS` has no one in it on Azure, nobody sees New Deal Lead, and each person can still add themselves.

## Manual QA checklist

1. Sign in with Microsoft. Dashboard opens and Outlook mail and calendar load.
2. Set a task to Done. It stays green with an X. Cancel, then Confirm.
3. Create a task and a relationship with no project. Both are blocked.
4. On Documents, click an empty FA icon and a filled NDA icon. Each opens that slot.
5. Open a profile from a task, a document and a meeting. Check the tab, then press Back.
6. Upload a transcript on a saved meeting and confirm the Gemini summary appears.
7. Add yourself as a deal lead. Edit your email. Confirm no second record appears.
8. Set Mary primary and Dennis additional on one deal. Lead Analysis counts it once, under Mary.
9. Use Settings > Excel Import, Download backup and Restore backup.

## Tests

See the commit message for results. `server/db/mongo.test.ts` cannot download its binary in the sandbox and fails before and after this work. Live Microsoft sign-in, Outlook, Gemini and two people sharing the roster through the server were not exercised in the test browser.
