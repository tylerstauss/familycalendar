import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "@/lib/google-calendar";
import { CalendarEvent } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let events;
  if (date) {
    events = await sql`
      SELECT * FROM events
      WHERE family_id = ${familyId} AND LEFT(start_time, 10) = ${date}
      ORDER BY start_time
    `;
  } else if (start && end) {
    events = await sql`
      SELECT * FROM events
      WHERE family_id = ${familyId}
        AND LEFT(start_time, 10) <= ${end}
        AND LEFT(end_time, 10) >= ${start}
      ORDER BY start_time
    `;
  } else {
    events = await sql`
      SELECT * FROM events
      WHERE family_id = ${familyId}
      ORDER BY start_time DESC LIMIT 100
    `;
  }

  const parsed = events.map((e: Record<string, unknown>) => ({
    ...e,
    assignee_ids: JSON.parse((e.assignee_ids as string) || "[]"),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const body = await req.json();
  const { title, start_time, end_time, location, notes, assignee_ids, recurrence } = body;

  if (!title?.trim() || !start_time || !end_time) {
    return NextResponse.json({ error: "Title, start_time, end_time required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO events (id, family_id, title, start_time, end_time, location, notes, assignee_ids, recurrence)
    VALUES (${id}, ${familyId}, ${title.trim()}, ${start_time}, ${end_time}, ${location || ""}, ${notes || ""}, ${JSON.stringify(assignee_ids || [])}, ${recurrence || ""})
  `;

  const [event] = await sql`SELECT * FROM events WHERE id = ${id} AND family_id = ${familyId}`;
  const parsed: CalendarEvent = { ...event, assignee_ids: JSON.parse((event.assignee_ids as string) || "[]") } as CalendarEvent;

  // Sync to Google Calendar (fire-and-forget — local save already succeeded)
  const googleId = await createGoogleEvent(familyId, parsed);
  if (googleId) {
    await sql`UPDATE events SET google_event_id = ${googleId} WHERE id = ${id} AND family_id = ${familyId}`;
    parsed.recurrence = parsed.recurrence; // keep shape
  }

  return NextResponse.json({ ...parsed, google_event_id: googleId ?? "" }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const body = await req.json();
  const { id, title, start_time, end_time, location, notes, assignee_ids, recurrence } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await sql`
    UPDATE events
    SET title = ${title}, start_time = ${start_time}, end_time = ${end_time},
        location = ${location || ""}, notes = ${notes || ""}, assignee_ids = ${JSON.stringify(assignee_ids || [])},
        recurrence = ${recurrence || ""}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [event] = await sql`SELECT * FROM events WHERE id = ${id} AND family_id = ${familyId}`;
  const parsed: CalendarEvent = { ...event, assignee_ids: JSON.parse((event.assignee_ids as string) || "[]") } as CalendarEvent;

  // Sync update to Google Calendar
  if (event.google_event_id) {
    await updateGoogleEvent(familyId, event.google_event_id as string, parsed);
  }

  return NextResponse.json(parsed);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();

  // Delete from Google Calendar before removing from DB
  const rows = await sql`SELECT google_event_id FROM events WHERE id = ${id} AND family_id = ${familyId}`;
  if (rows[0]?.google_event_id) {
    await deleteGoogleEvent(familyId, rows[0].google_event_id as string);
  }

  await sql`DELETE FROM events WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
