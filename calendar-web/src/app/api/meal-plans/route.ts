import { NextRequest, NextResponse } from "next/server";
import db, { newId } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");   // YYYY-MM-DD
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end");     // YYYY-MM-DD

  let plans;
  if (date) {
    plans = db.prepare("SELECT * FROM meal_plans WHERE date = ? ORDER BY meal_type").all(date) as Record<string, unknown>[];
  } else if (start && end) {
    plans = db.prepare(
      "SELECT * FROM meal_plans WHERE date >= ? AND date <= ? ORDER BY date, meal_type"
    ).all(start, end) as Record<string, unknown>[];
  } else {
    plans = db.prepare("SELECT * FROM meal_plans ORDER BY date DESC LIMIT 100").all() as Record<string, unknown>[];
  }

  const parsed = plans.map((p: Record<string, unknown>) => ({
    ...p,
    assignee_ids: JSON.parse((p.assignee_ids as string) || "[]"),
  }));

  return NextResponse.json(parsed);
}

export async function POST(req: NextRequest) {
  const { date, meal_type, recipe_id, recipe_name, notes, assignee_ids } = await req.json();
  if (!date || !meal_type) {
    return NextResponse.json({ error: "Date and meal_type required" }, { status: 400 });
  }

  const id = newId();
  db.prepare(
    "INSERT INTO meal_plans (id, date, meal_type, recipe_id, recipe_name, notes, assignee_ids) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, date, meal_type, recipe_id || null, recipe_name || "", notes || "", JSON.stringify(assignee_ids || []));

  const plan = db.prepare("SELECT * FROM meal_plans WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...plan,
    assignee_ids: JSON.parse((plan.assignee_ids as string) || "[]"),
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, date, meal_type, recipe_id, recipe_name, notes, assignee_ids } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  db.prepare(
    "UPDATE meal_plans SET date=?, meal_type=?, recipe_id=?, recipe_name=?, notes=?, assignee_ids=? WHERE id=?"
  ).run(date, meal_type, recipe_id || null, recipe_name || "", notes || "", JSON.stringify(assignee_ids || []), id);

  const plan = db.prepare("SELECT * FROM meal_plans WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    ...plan,
    assignee_ids: JSON.parse((plan.assignee_ids as string) || "[]"),
  });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  db.prepare("DELETE FROM meal_plans WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
