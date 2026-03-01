import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let plans;
  if (date) {
    plans = await sql`
      SELECT * FROM meal_plans WHERE family_id = ${familyId} AND date = ${date} ORDER BY meal_type
    `;
  } else if (start && end) {
    plans = await sql`
      SELECT * FROM meal_plans
      WHERE family_id = ${familyId} AND date >= ${start} AND date <= ${end}
      ORDER BY date, meal_type
    `;
  } else {
    plans = await sql`
      SELECT * FROM meal_plans WHERE family_id = ${familyId} ORDER BY date DESC LIMIT 100
    `;
  }

  const parsed = plans.map((p: Record<string, unknown>) => ({
    ...p,
    food_item_id: p.recipe_id,
    food_name: p.recipe_name,
    assignee_ids: JSON.parse((p.assignee_ids as string) || "[]"),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { date, meal_type, food_item_id, food_name, notes, assignee_ids } = await req.json();
  if (!date || !meal_type) {
    return NextResponse.json({ error: "Date and meal_type required" }, { status: 400 });
  }

  const id = newId();
  await sql`
    INSERT INTO meal_plans (id, family_id, date, meal_type, recipe_id, recipe_name, notes, assignee_ids)
    VALUES (${id}, ${familyId}, ${date}, ${meal_type}, ${food_item_id || null}, ${food_name || ""}, ${notes || ""}, ${JSON.stringify(assignee_ids || [])})
  `;

  const [plan] = await sql`SELECT * FROM meal_plans WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json(
    { ...plan, food_item_id: plan.recipe_id, food_name: plan.recipe_name, assignee_ids: JSON.parse((plan.assignee_ids as string) || "[]") },
    { status: 201 }
  );
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, date, meal_type, food_item_id, food_name, notes, assignee_ids } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await sql`
    UPDATE meal_plans
    SET date = ${date}, meal_type = ${meal_type}, recipe_id = ${food_item_id || null},
        recipe_name = ${food_name || ""}, notes = ${notes || ""}, assignee_ids = ${JSON.stringify(assignee_ids || [])}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [plan] = await sql`SELECT * FROM meal_plans WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ...plan, food_item_id: plan.recipe_id, food_name: plan.recipe_name, assignee_ids: JSON.parse((plan.assignee_ids as string) || "[]") });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM meal_plans WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
