# Newport CRM — what still needs to be fixed (updated Oct 30, 2026, evening)

Status after the Oct 30 sprint. Full test results are in `docs/SPRINT_OCT30_ACCEPTANCE.md`.

## Needs an admin or a Newport decision

1. **AI meeting summaries — ON (Google Gemini).** Tested live on Oct 30 with a made-up transcript:
   the connection test answered in under 1 second and a summary returned in about 2 seconds.
   Still open: the key is on Google's free tier. Turn on billing in Google AI Studio, or get Newport's
   approval, before real transcripts are sent. See `docs/MEETINGS_AI_AND_STORAGE.md`.
2. **Approve calendar access in the work tenant.** A Microsoft 365 admin may need to approve the
   app's `Calendars.ReadWrite` permission.
3. **Meeting history and transcripts — DONE.** Shared with approved workspace users through the
   Newport server (commit 87ff422). Still open: choose a retention period.

## Data to clean up in the CRM

4. **DONE (commit 1a55d31).** Four Completed deals were not at the Closing stage: Project Q, Project X, Project AE and
   Project AL. Set each stage to Closing, or change the status.
5. **DONE (commit 1a55d31). Deal leads.** Some older deals use "Alex Rivera", who is not a CRM user, and one deal has no
   deal lead. Assign each to Mary Sbaschnig or Dennis DiCapua.
6. **Missing dates on older records.** 42 older deals have no creation date and 5 older Completed
   deals have no completion date. Reports leave them out of trends. Enter real dates if they are known.
7. **Older tasks have no original due date.** 16 missed-deadline counts use the current due date.
   This fixes itself for tasks created from now on.

## Needs testing while signed in to Microsoft

8. **PASSED Oct 30.** Bell lists overdue tasks and unread emails; "View all in Email" opens Email.
   The connected Microsoft account signs in with a Gmail address, so its Outlook mailbox is empty
   (mailbox check: 0 messages on the server). Use Connect Gmail to read that mail.
9. **Calendar events load — PASSED Oct 30.** Not yet tested: New Event saves to Outlook, Teams link is created.
10. **PASSED Oct 30.** Meetings calendar dots and Upcoming Meetings show real Outlook events.
11. Add Meeting with "send invitations" creates the Outlook event.
12. Summary service **PASSED Oct 30** (made-up transcript through the live server). Not yet tested in
    the page: upload a transcript file and use Create Task on a proposed follow-up.
13. Reports: open a CSV and a JSON export and check they match the selected tab and period.

## Smaller improvements

14. **DONE (commit 87ff422).** Opt-in sender photos for directory users; initials otherwise.
15. **DONE (commit 87ff422).** Phone card layouts for Opportunities, Tasks and Relationships.
16. **DONE (commit 87ff422).** CI runs all tests, including MongoDB.
17. Lint shows a few older warnings (`set-state-in-effect`, fast refresh). No errors.
