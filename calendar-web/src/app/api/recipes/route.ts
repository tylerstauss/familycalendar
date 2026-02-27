import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const recipes = await sql`
    SELECT * FROM recipes WHERE family_id = ${familyId} ORDER BY name
  `;
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
  await sql`
    INSERT INTO recipes (id, family_id, name, ingredients, instructions)
    VALUES (${id}, ${familyId}, ${name.trim()}, ${JSON.stringify(ingredients || [])}, ${instructions || ""})
  `;

  const [recipe] = await sql`SELECT * FROM recipes WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json(
    { ...recipe, ingredients: JSON.parse((recipe.ingredients as string) || "[]") },
    { status: 201 }
  );
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, name, ingredients, instructions } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await sql`
    UPDATE recipes
    SET name = ${name}, ingredients = ${JSON.stringify(ingredients || [])}, instructions = ${instructions || ""}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [recipe] = await sql`SELECT * FROM recipes WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ...recipe, ingredients: JSON.parse((recipe.ingredients as string) || "[]") });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM recipes WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
