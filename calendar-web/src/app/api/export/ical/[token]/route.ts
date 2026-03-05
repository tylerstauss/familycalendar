import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Escape special characters per RFC 5545
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toIcalDate(iso: string): string {
  // Format: 20261031T143000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace(/\.\d{3}$/, "");
}

function isAllDay(start: string, end: string): boolean {
  const s = new Date(start);
  const e = new Date(end);
  return (
    s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0 &&
    e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0 &&
    e.getTime() - s.getTime() >= 86400000
  );
}

// Fold long lines at 75 octets per RFC 5545
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join("\r\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up family by ical_token
  const rows = await sql`SELECT id, name FROM families WHERE ical_token = ${token}`;
  const family = rows[0];
  if (!family) {
    return new NextResponse("Not found", { status: 404 });
  }
  const familyId = family.id as string;
  const familyName = family.name as string;

  // Fetch events: last 60 days + next 365 days
  const rangeStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rangeEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const events = await sql`
    SELECT * FROM events
    WHERE family_id = ${familyId}
      AND LEFT(start_time, 10) >= ${rangeStart}
      AND LEFT(start_time, 10) <= ${rangeEnd}
      AND (notes IS NULL OR notes NOT LIKE '%__ride_driver__%')
    ORDER BY start_time
  `;

  const now = toIcalDate(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Calendar//Family Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(familyName)}`,
    "X-WR-CALDESC:Family Calendar",
  ];

  for (const evt of events) {
    const start = evt.start_time as string;
    const end = evt.end_time as string;
    const allDay = isAllDay(start, end);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${evt.id}@familycalendar`);
    lines.push(`DTSTAMP:${now}`);

    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start.slice(0, 10).replace(/-/g, "")}`);
      // iCal all-day end is exclusive; our DB end is already exclusive midnight
      lines.push(`DTEND;VALUE=DATE:${end.slice(0, 10).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${toIcalDate(start)}`);
      lines.push(`DTEND:${toIcalDate(end)}`);
    }

    lines.push(foldLine(`SUMMARY:${esc(evt.title as string)}`));

    if (evt.location) {
      lines.push(foldLine(`LOCATION:${esc(evt.location as string)}`));
    }
    if (evt.notes) {
      lines.push(foldLine(`DESCRIPTION:${esc(evt.notes as string)}`));
    }
    if (evt.recurrence) {
      lines.push(`RRULE:${evt.recurrence}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="family-calendar.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
