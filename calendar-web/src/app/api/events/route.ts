import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end");     // YYYY-MM-DD

  let events;
  if (date) {
    // Single day
    events = db.prepare(
      "SELECT * FROM events WHERE date(start_time) = ? ORDER BY start_time"
    ).all(date) as Record<string, unknown>[];
  } else if (start && end) {
    // Date range
    events = db.prepare(
      "SELECT * FROM events WHERE date(start_time) >= ? AND date(start_time) <= ? ORDER BY start_time"
    ).all(start, end) as Record<string, unknown>[];
  } else {
    events = db.prepare("SELECT * FROM events ORDER BY start_time DESC LIMIT 100").all() as Record<string, unknown>[];
  }

  // Parse JSON fields
  const parsed = events.map((e: Record<string, unknown>) => ({
    ...e,
    assignee_ids: JSON.parse((e.assignee_ids as string) || "[]"),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, start_time, end_time, location, notes, assignee_ids } = body;

  if (!title?.trim() || !start_time || !end_time) {
    return NextResponse.json({ error: "Title, start_time, end_time required" }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    "INSERT INTO events (id, title, start_time, end_time, location, notes, assignee_ids) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, title.trim(), start_time, end_time, location || "", notes || "", JSON.stringify(assignee_ids || []));

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...event,
    assignee_ids: JSON.parse((event.assignee_ids as string) || "[]"),
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, title, start_time, end_time, location, notes, assignee_ids } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  db.prepare(
    "UPDATE events SET title=?, start_time=?, end_time=?, location=?, notes=?, assignee_ids=? WHERE id=?"
  ).run(title, start_time, end_time, location || "", notes || "", JSON.stringify(assignee_ids || []), id);

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...event,
    assignee_ids: JSON.parse((event.assignee_ids as string) || "[]"),
  });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
