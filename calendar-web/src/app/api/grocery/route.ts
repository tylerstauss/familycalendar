import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const items = await sql`
    SELECT * FROM grocery_items WHERE family_id = ${familyId} ORDER BY checked, created_at DESC
  `;
  const parsed = items.map((i: Record<string, unknown>) => ({
    ...i,
    checked: Boolean(i.checked),
  }));
  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name, recipe_id } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO grocery_items (id, family_id, name, recipe_id)
    VALUES (${id}, ${familyId}, ${name.trim()}, ${recipe_id || null})
  `;

  const [item] = await sql`SELECT * FROM grocery_items WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  if (name !== undefined) {
    await sql`UPDATE grocery_items SET name = ${name} WHERE id = ${id} AND family_id = ${familyId}`;
  }
  if (checked !== undefined) {
    await sql`UPDATE grocery_items SET checked = ${checked ? 1 : 0} WHERE id = ${id} AND family_id = ${familyId}`;
  }

  const [item] = await sql`SELECT * FROM grocery_items WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, clear_checked } = await req.json();

  if (clear_checked) {
    await sql`DELETE FROM grocery_items WHERE family_id = ${familyId} AND checked = 1`;
  } else if (id) {
    await sql`DELETE FROM grocery_items WHERE id = ${id} AND family_id = ${familyId}`;
  }

  return NextResponse.json({ ok: true });
}
