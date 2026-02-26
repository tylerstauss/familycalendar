import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const items = db
    .prepare("SELECT * FROM grocery_items WHERE family_id = ? ORDER BY checked, created_at DESC")
    .all(familyId) as Record<string, unknown>[];
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
  db.prepare(
    "INSERT INTO grocery_items (id, family_id, name, recipe_id) VALUES (?, ?, ?, ?)"
  ).run(id, familyId, name.trim(), recipe_id || null);

  const item = db
    .prepare("SELECT * FROM grocery_items WHERE id = ? AND family_id = ?")
    .get(id, familyId) as Record<string, unknown>;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  if (name !== undefined) {
    db.prepare("UPDATE grocery_items SET name=? WHERE id=? AND family_id=?").run(name, id, familyId);
  }
  if (checked !== undefined) {
    db.prepare("UPDATE grocery_items SET checked=? WHERE id=? AND family_id=?").run(checked ? 1 : 0, id, familyId);
  }

  const item = db
    .prepare("SELECT * FROM grocery_items WHERE id = ? AND family_id = ?")
    .get(id, familyId) as Record<string, unknown>;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, clear_checked } = await req.json();

  if (clear_checked) {
    db.prepare("DELETE FROM grocery_items WHERE family_id = ? AND checked = 1").run(familyId);
  } else if (id) {
    db.prepare("DELETE FROM grocery_items WHERE id = ? AND family_id = ?").run(id, familyId);
  }

  return NextResponse.json({ ok: true });
}
