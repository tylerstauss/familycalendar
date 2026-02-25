import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { FAMILY_CALENDAR_COLORS } from "@/lib/types";

export function GET() {
  const calendars = db.prepare("SELECT * FROM family_calendars ORDER BY created_at").all();
  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const count = db.prepare("SELECT COUNT(*) as count FROM family_calendars").get() as { count: number };
  const chosenColor = color || FAMILY_CALENDAR_COLORS[count.count % FAMILY_CALENDAR_COLORS.length];
  const id = newId();
  db.prepare("INSERT INTO family_calendars (id, name, color) VALUES (?, ?, ?)").run(id, name.trim(), chosenColor);
  return NextResponse.json(db.prepare("SELECT * FROM family_calendars WHERE id = ?").get(id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, name, color, ical_url } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const url = (ical_url ?? "").trim();
  if (url && !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  }

  if (name !== undefined) {
    db.prepare("UPDATE family_calendars SET name = ? WHERE id = ?").run(name.trim(), id);
  }
  if (color !== undefined) {
    db.prepare("UPDATE family_calendars SET color = ? WHERE id = ?").run(color, id);
  }
  if (ical_url !== undefined) {
    db.prepare("UPDATE family_calendars SET ical_url = ? WHERE id = ?").run(url, id);
  }

  return NextResponse.json(db.prepare("SELECT * FROM family_calendars WHERE id = ?").get(id));
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  db.prepare("DELETE FROM family_calendars WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
