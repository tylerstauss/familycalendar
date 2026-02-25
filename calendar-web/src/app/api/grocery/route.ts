import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";

export function GET() {
  const items = db.prepare(
    "SELECT * FROM grocery_items ORDER BY checked, created_at DESC"
  ).all() as Record<string, unknown>[];
  const parsed = items.map((i: Record<string, unknown>) => ({
    ...i,
    checked: Boolean(i.checked),
  }));
  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const { name, recipe_id } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    "INSERT INTO grocery_items (id, name, recipe_id) VALUES (?, ?, ?)"
  ).run(id, name.trim(), recipe_id || null);

  const item = db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, name, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  if (name !== undefined) {
    db.prepare("UPDATE grocery_items SET name=? WHERE id=?").run(name, id);
  }
  if (checked !== undefined) {
    db.prepare("UPDATE grocery_items SET checked=? WHERE id=?").run(checked ? 1 : 0, id);
  }

  const item = db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({ ...item, checked: Boolean(item.checked) });
}

export async function DELETE(req: NextRequest) {
  const { id, clear_checked } = await req.json();

  if (clear_checked) {
    db.prepare("DELETE FROM grocery_items WHERE checked = 1").run();
  } else if (id) {
    db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id);
  }

  return NextResponse.json({ ok: true });
}
