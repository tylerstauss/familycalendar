import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getIcalEvents, getFamilyCalendarEvents } from "@/lib/ical";
import { FamilyMember, FamilyCalendar, CalendarEvent } from "@/lib/types";

export async function GET(req: NextRequest) {
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

  // Get all members and family calendars with an ical_url configured
  const members = db
    .prepare("SELECT * FROM family_members WHERE ical_url IS NOT NULL AND ical_url != ''")
    .all() as FamilyMember[];

  const familyCalendars = db
    .prepare("SELECT * FROM family_calendars WHERE ical_url IS NOT NULL AND ical_url != ''")
    .all() as FamilyCalendar[];

  if (members.length === 0 && familyCalendars.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch all feeds in parallel — one broken URL won't block others
  const results = await Promise.allSettled([
    ...members.map((m) => getIcalEvents(m.id, m.ical_url!, rangeStart, rangeEnd)),
    ...familyCalendars.map((c) => getFamilyCalendarEvents(c.id, c.color, c.ical_url, rangeStart, rangeEnd)),
  ]);

  const allEvents: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return NextResponse.json(allEvents);
}
