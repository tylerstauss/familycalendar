import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const recipes = db
    .prepare("SELECT * FROM recipes WHERE family_id = ? ORDER BY name")
    .all(familyId) as Record<string, unknown>[];
  const parsed = recipes.map((r: Record<string, unknown>) => ({
    ...r,
    ingredients: JSON.parse((r.ingredients as string) || "[]"),
  }));
  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { name, ingredients, instructions } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    "INSERT INTO recipes (id, family_id, name, ingredients, instructions) VALUES (?, ?, ?, ?, ?)"
  ).run(id, familyId, name.trim(), JSON.stringify(ingredients || []), instructions || "");

  const recipe = db
    .prepare("SELECT * FROM recipes WHERE id = ? AND family_id = ?")
    .get(id, familyId) as Record<string, unknown>;
  return NextResponse.json({
    ...recipe,
    ingredients: JSON.parse((recipe.ingredients as string) || "[]"),
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, ingredients, instructions } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  db.prepare(
    "UPDATE recipes SET name=?, ingredients=?, instructions=? WHERE id=? AND family_id=?"
  ).run(name, JSON.stringify(ingredients || []), instructions || "", id, familyId);

  const recipe = db
    .prepare("SELECT * FROM recipes WHERE id = ? AND family_id = ?")
    .get(id, familyId) as Record<string, unknown>;
  return NextResponse.json({
    ...recipe,
    ingredients: JSON.parse((recipe.ingredients as string) || "[]"),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  db.prepare("DELETE FROM recipes WHERE id = ? AND family_id = ?").run(id, familyId);
  return NextResponse.json({ ok: true });
}
