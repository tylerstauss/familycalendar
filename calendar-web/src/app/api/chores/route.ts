import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const chores = await sql`
    SELECT * FROM chores
    WHERE family_id = ${familyId} AND active = 1
    ORDER BY created_at ASC
  `;

  return NextResponse.json(chores);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const body = await req.json();
  const { name, assignee_id, frequency, week_day, due_date, star_value } = body;

  if (!name?.trim() || !assignee_id || !frequency) {
    return NextResponse.json({ error: "name, assignee_id, frequency required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO chores (id, family_id, name, assignee_id, frequency, week_day, due_date, star_value)
    VALUES (
      ${id}, ${familyId}, ${name.trim()}, ${assignee_id}, ${frequency},
      ${week_day ?? null}, ${due_date ?? null}, ${star_value ?? 1}
    )
  `;

  const [chore] = await sql`SELECT * FROM chores WHERE id = ${id}`;
  return NextResponse.json(chore, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const body = await req.json();
  const { id, name, star_value, active } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await sql`
    UPDATE chores
    SET name = ${name}, star_value = ${star_value}, active = ${active}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [chore] = await sql`SELECT * FROM chores WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json(chore);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM chores WHERE id = ${id} AND family_id = ${familyId}`;
  await sql`DELETE FROM chore_completions WHERE chore_id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
