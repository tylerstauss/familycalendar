import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const items = await sql`
    SELECT * FROM food_items WHERE family_id = ${familyId} ORDER BY name ASC
  `;

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO food_items (id, family_id, name)
    VALUES (${id}, ${familyId}, ${name.trim()})
  `;

  const [item] = await sql`SELECT * FROM food_items WHERE id = ${id}`;
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name } = await req.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "id and name required" }, { status: 400 });
  }

  await sql`
    UPDATE food_items SET name = ${name.trim()} WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [item] = await sql`SELECT * FROM food_items WHERE id = ${id}`;
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM food_items WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
