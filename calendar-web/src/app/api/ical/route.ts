import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getIcalEvents, getFamilyCalendarEvents } from "@/lib/ical";
import { FamilyMember, FamilyCalendar, CalendarEvent } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let rangeStart: Date;
  let rangeEnd: Date;

  if (date) {
    rangeStart = new Date(`${date}T00:00:00`);
    rangeEnd = new Date(`${date}T23:59:59`);
  } else if (start && end) {
    rangeStart = new Date(`${start}T00:00:00`);
    rangeEnd = new Date(`${end}T23:59:59`);
  } else {
    return NextResponse.json({ error: "Provide ?date= or ?start=&end=" }, { status: 400 });
  }

  // All visible members — used for iCal fetching AND for name-matching in family calendars
  const allMembers = (await sql`
    SELECT * FROM family_members
    WHERE family_id = ${familyId}
      AND (hidden = 0 OR hidden IS NULL)
  `) as FamilyMember[];

  const icalMembers = allMembers.filter((m) => m.ical_url);

  const familyCalendars = (await sql`
    SELECT * FROM family_calendars
    WHERE family_id = ${familyId}
      AND ical_url IS NOT NULL AND ical_url != ''
      AND (hidden = 0 OR hidden IS NULL)
  `) as FamilyCalendar[];

  if (icalMembers.length === 0 && familyCalendars.length === 0) {
    return NextResponse.json([]);
  }

  const results = await Promise.allSettled([
    ...icalMembers.map((m) => getIcalEvents(m.id, m.ical_url!, rangeStart, rangeEnd)),
    ...familyCalendars.map((c) => getFamilyCalendarEvents(c.id, c.color, c.ical_url, rangeStart, rangeEnd, allMembers)),
  ]);

  const allEvents: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  }

  allEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return NextResponse.json(allEvents);
}
