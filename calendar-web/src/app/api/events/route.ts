import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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
  return NextResponse.json(
    { ...event, assignee_ids: JSON.parse((event.assignee_ids as string) || "[]") },
    { status: 201 }
  );
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
  return NextResponse.json({ ...event, assignee_ids: JSON.parse((event.assignee_ids as string) || "[]") });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM events WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
