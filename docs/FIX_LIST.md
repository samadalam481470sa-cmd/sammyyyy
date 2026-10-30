# Newport CRM — what still needs to be fixed (Oct 30, 2026)

Status after the Oct 30 sprint. Full test results are in `docs/SPRINT_OCT30_ACCEPTANCE.md`.

## Needs an admin or a Newport decision

1. **Turn on AI meeting summaries.** On the Azure App Service, set `MEETING_SUMMARY_ENABLED=1` and
   `OPENAI_API_KEY`. Newport must approve the provider and its data terms first. Until then,
   Meetings shows "Summary unavailable".
2. **Approve calendar access in the work tenant.** A Microsoft 365 admin may need to approve the
   app's `Calendars.ReadWrite` permission.
3. **Decide who can see meeting history and transcripts.** They are private to each user, on one
   device, for now. Pick a shared store (SharePoint per deal or the Newport server) and a retention period.

## Data to clean up in the CRM

4. **Four Completed deals are not at the Closing stage:** Project Q, Project X, Project AE and
   Project AL. Set each stage to Closing, or change the status.
5. **Deal leads.** Some older deals use "Alex Rivera", who is not a CRM user, and one deal has no
   deal lead. Assign each to Mary Sbaschnig or Dennis DiCapua.
6. **Missing dates on older records.** 42 older deals have no creation date and 5 older Completed
   deals have no completion date. Reports leave them out of trends. Enter real dates if they are known.
7. **Older tasks have no original due date.** 16 missed-deadline counts use the current due date.
   This fixes itself for tasks created from now on.

## Needs testing while signed in to Microsoft

8. Bell: the five newest unread emails and "View all in Email".
9. Email > Calendar: events load, New Event saves to Outlook, Teams link is created.
10. Meetings: calendar dots and Upcoming Meetings show real Outlook events.
11. Add Meeting with "send invitations" creates the Outlook event.
12. After summaries are turned on: upload a transcript, check the summary, and use Create Task on a
    proposed follow-up.
13. Reports: open a CSV and a JSON export and check they match the selected tab and period.

## Smaller improvements

14. Sender photos are not shown (initials only). Showing photos needs one more Graph permission.
15. On phones, tables scroll sideways. A card layout would read better.
16. `server/db/mongo.test.ts` could not run in the build workspace (blocked download). Run it in CI.
17. Lint shows older warnings (`set-state-in-effect` in a few forms). No errors.
