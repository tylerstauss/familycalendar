import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { FAMILY_CALENDAR_COLORS } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const calendars = db
    .prepare("SELECT * FROM family_calendars WHERE family_id = ? ORDER BY created_at")
    .all(familyId);
  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const count = db
    .prepare("SELECT COUNT(*) as count FROM family_calendars WHERE family_id = ?")
    .get(familyId) as { count: number };
  const chosenColor = color || FAMILY_CALENDAR_COLORS[count.count % FAMILY_CALENDAR_COLORS.length];
  const id = newId();
  db.prepare(
    "INSERT INTO family_calendars (id, family_id, name, color) VALUES (?, ?, ?, ?)"
  ).run(id, familyId, name.trim(), chosenColor);
  return NextResponse.json(
    db.prepare("SELECT * FROM family_calendars WHERE id = ? AND family_id = ?").get(id, familyId),
    { status: 201 }
  );
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, color, ical_url } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const url = (ical_url ?? "").trim();
  if (url && !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  }

  if (name !== undefined) {
    db.prepare("UPDATE family_calendars SET name = ? WHERE id = ? AND family_id = ?").run(name.trim(), id, familyId);
  }
  if (color !== undefined) {
    db.prepare("UPDATE family_calendars SET color = ? WHERE id = ? AND family_id = ?").run(color, id, familyId);
  }
  if (ical_url !== undefined) {
    db.prepare("UPDATE family_calendars SET ical_url = ? WHERE id = ? AND family_id = ?").run(url, id, familyId);
  }

  return NextResponse.json(
    db.prepare("SELECT * FROM family_calendars WHERE id = ? AND family_id = ?").get(id, familyId)
  );
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  db.prepare("DELETE FROM family_calendars WHERE id = ? AND family_id = ?").run(id, familyId);
  return NextResponse.json({ ok: true });
}
