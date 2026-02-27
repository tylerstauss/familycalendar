import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { FAMILY_CALENDAR_COLORS } from "@/lib/types";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const calendars = await sql`
    SELECT * FROM family_calendars WHERE family_id = ${familyId} ORDER BY created_at
  `;
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

  const [countRow] = await sql`
    SELECT COUNT(*) as count FROM family_calendars WHERE family_id = ${familyId}
  `;
  const count = parseInt(countRow.count as string, 10);
  const chosenColor = color || FAMILY_CALENDAR_COLORS[count % FAMILY_CALENDAR_COLORS.length];
  const id = newId();

  await sql`
    INSERT INTO family_calendars (id, family_id, name, color) VALUES (${id}, ${familyId}, ${name.trim()}, ${chosenColor})
  `;

  const [cal] = await sql`
    SELECT * FROM family_calendars WHERE id = ${id} AND family_id = ${familyId}
  `;
  return NextResponse.json(cal, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, color, ical_url, hidden } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const url = (ical_url ?? "").trim();
  if (url && !url.startsWith("https://")) {
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  }

  if (name !== undefined) {
    await sql`UPDATE family_calendars SET name = ${name.trim()} WHERE id = ${id} AND family_id = ${familyId}`;
  }
  if (color !== undefined) {
    await sql`UPDATE family_calendars SET color = ${color} WHERE id = ${id} AND family_id = ${familyId}`;
  }
  if (ical_url !== undefined) {
    await sql`UPDATE family_calendars SET ical_url = ${url} WHERE id = ${id} AND family_id = ${familyId}`;
  }
  if (hidden !== undefined) {
    await sql`UPDATE family_calendars SET hidden = ${hidden ? 1 : 0} WHERE id = ${id} AND family_id = ${familyId}`;
  }

  const [cal] = await sql`
    SELECT * FROM family_calendars WHERE id = ${id} AND family_id = ${familyId}
  `;
  return NextResponse.json(cal);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM family_calendars WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
