import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function parseMeal(row: Record<string, unknown>) {
  return {
    ...row,
    food_item_ids: JSON.parse((row.food_item_ids as string) || "[]"),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const rows = await sql`
    SELECT * FROM meals WHERE family_id = ${familyId} ORDER BY name ASC
  `;

  return NextResponse.json(rows.map(parseMeal));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name, food_item_ids = [] } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const id = newId();
  const foodIds = JSON.stringify(food_item_ids);
  await sql`
    INSERT INTO meals (id, family_id, name, food_item_ids)
    VALUES (${id}, ${familyId}, ${name.trim()}, ${foodIds})
  `;

  const [row] = await sql`SELECT * FROM meals WHERE id = ${id}`;
  return NextResponse.json(parseMeal(row), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, food_item_ids = [] } = await req.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "id and name required" }, { status: 400 });
  }

  const foodIds = JSON.stringify(food_item_ids);
  await sql`
    UPDATE meals SET name = ${name.trim()}, food_item_ids = ${foodIds}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [row] = await sql`SELECT * FROM meals WHERE id = ${id}`;
  return NextResponse.json(parseMeal(row));
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM meals WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
