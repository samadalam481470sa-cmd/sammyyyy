import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Outlook opens standard iCalendar files. This avoids a vendor-specific OAuth
 * dependency while still giving the CRM a one-click "Add to Outlook" action.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!followUp) {
    return NextResponse.json({ error: "Follow-up not found." }, { status: 404 });
  }

  const start = followUp.dueAt;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Newport Specialty Partners//Insurance CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${followUp.id}@newportsp.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs(`${followUp.title} — ${followUp.client.companyName}`)}`,
    `DESCRIPTION:${escapeIcs(
      [
        `Client: ${followUp.client.companyName}`,
        `Contact: ${followUp.client.contactName}`,
        `Email: ${followUp.client.email}`,
        followUp.notes ? `Notes: ${followUp.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )}`,
    `ORGANIZER;CN=${escapeIcs(followUp.assignedTo)}:mailto:crm@newportsp.com`,
    `ATTENDEE;CN=${escapeIcs(followUp.client.contactName)};RSVP=FALSE:mailto:${followUp.client.email}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Newport CRM follow-up",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="newport-follow-up-${safeFilename(
        followUp.client.companyName,
      )}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
