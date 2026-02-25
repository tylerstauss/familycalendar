import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";

export function GET() {
  const recipes = db.prepare("SELECT * FROM recipes ORDER BY name").all() as Record<string, unknown>[];
  const parsed = recipes.map((r: Record<string, unknown>) => ({
    ...r,
    ingredients: JSON.parse((r.ingredients as string) || "[]"),
  }));
  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const { name, ingredients, instructions } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    "INSERT INTO recipes (id, name, ingredients, instructions) VALUES (?, ?, ?, ?)"
  ).run(id, name.trim(), JSON.stringify(ingredients || []), instructions || "");

  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...recipe,
    ingredients: JSON.parse((recipe.ingredients as string) || "[]"),
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, name, ingredients, instructions } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  db.prepare(
    "UPDATE recipes SET name=?, ingredients=?, instructions=? WHERE id=?"
  ).run(name, JSON.stringify(ingredients || []), instructions || "", id);

  const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...recipe,
    ingredients: JSON.parse((recipe.ingredients as string) || "[]"),
  });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
