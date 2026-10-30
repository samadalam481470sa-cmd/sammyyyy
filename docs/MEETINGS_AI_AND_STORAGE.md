# Meetings: calendar, transcripts, AI summaries — what production needs

This page lists exactly what the Meetings and Email Calendar features use today, and what Newport
would need to approve before using them with real acquisition meetings.

## What runs today

| Feature | Where the data lives | Leaves the device? |
| --- | --- | --- |
| Outlook calendar (Email > Calendar, Meetings) | Microsoft Graph, read with the signed-in user's own delegated token (`Calendars.ReadWrite`, already part of the Outlook sign-in). A copy of the last loaded events is cached in that browser. | Only between the browser and Microsoft. |
| New events / Add Meeting with invite | Created in the user's Outlook calendar through Graph. Nothing is saved locally unless Graph confirms it. | Browser to Microsoft only. |
| CRM meeting history (linked project, contacts, CRM-only title, notes, recording link) | That browser's local storage, per signed-in user. **Private to the user.** Not sent to the shared workspace. | No. |
| Transcript files and extracted text | That browser's IndexedDB file store. Never placed in the public site or its static files. | No, unless a summary is requested (below). |
| AI meeting summary | Only when the Newport server has an administrator-approved service (see below). Otherwise the app shows "Summary unavailable" and keeps the transcript. | Transcript text goes browser → Newport server → AI provider, only when enabled. |
| Recordings | Not stored. Only an `https://` link to where the recording already lives (Stream, SharePoint, Zoom cloud). | No. |

What the CRM does **not** do: it does not record, transcribe, or listen to Teams or Zoom calls, and
it does not pull Teams transcripts automatically. A person uploads a transcript after the meeting.
Outlook attendees are never turned into Relationship records automatically. Removing a meeting from
CRM history never edits or deletes the Outlook event.

## Turning on AI summaries (server)

The shared Newport server (`server/`, Azure App Service) has two routes, both behind the normal
Microsoft workspace sign-in:

- `GET /api/workspace/ai/status` — tells the browser whether summaries are available.
- `POST /api/workspace/ai/meeting-summary` — body `{ "transcript": "..." }`.

They stay **off** unless both settings are present in the server's environment:

```
MEETING_SUMMARY_ENABLED=1
OPENAI_API_KEY=<secret, server only>
# optional
OPENAI_MODEL=gpt-4o-mini
```

`MEETING_SUMMARY_ENABLED=1` is the explicit approval to send transcript text to that provider.
The key is never sent to browsers. The model receives only the transcript text, with instructions to
use nothing else; its answer is checked against a fixed shape and rejected if it does not match.
The audit log records that a summary ran and its length, never the transcript.

## Decisions Newport should make before real use

1. **AI provider and data terms.** Confirm the provider (OpenAI API, or Azure OpenAI in Newport's
   own tenant), its data-retention and no-training terms, and who may enable it.
2. **Where transcripts are stored.** Today they stay in one browser. For sharing across the team,
   choose a store with access control (for example SharePoint/OneDrive per deal, or the Newport
   server's database with encryption at rest) and a retention period.
3. **Who can see meeting history.** It is private per user now. Decide whether deal teams should
   see each other's meeting records.
4. **Microsoft 365 consent.** In a work tenant, an admin may need to approve the app's delegated
   `Calendars.ReadWrite` permission. Personal Microsoft accounts may not be able to create Teams
   links; the app shows Microsoft's refusal instead of pretending.
