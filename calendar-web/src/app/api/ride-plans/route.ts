import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  let rows;
  if (eventId) {
    rows = await sql`
      SELECT * FROM ride_plans WHERE family_id = ${familyId} AND event_id = ${eventId} ORDER BY created_at
    `;
  } else {
    rows = await sql`
      SELECT * FROM ride_plans WHERE family_id = ${familyId} ORDER BY created_at
    `;
  }

  const plans = rows.map((r) => ({
    ...r,
    passengers: typeof r.passengers === "string" ? JSON.parse(r.passengers) : r.passengers,
  }));

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { event_id, plan_type, driver_id, passengers, drive_mins, drive_km, notes } = await req.json();

  if (!event_id || !plan_type || !driver_id) {
    return NextResponse.json({ error: "event_id, plan_type, and driver_id are required" }, { status: 400 });
  }
  if (plan_type !== "dropoff" && plan_type !== "pickup") {
    return NextResponse.json({ error: "plan_type must be 'dropoff' or 'pickup'" }, { status: 400 });
  }

  // Verify event belongs to family
  const [event] = await sql`SELECT id FROM events WHERE id = ${event_id} AND family_id = ${familyId}`;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify driver belongs to family
  const [driver] = await sql`SELECT id FROM family_members WHERE id = ${driver_id} AND family_id = ${familyId}`;
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  // Upsert: delete existing plan for same event+type, insert new one
  await sql`
    DELETE FROM ride_plans WHERE family_id = ${familyId} AND event_id = ${event_id} AND plan_type = ${plan_type}
  `;

  const id = newId();
  const passengersJson = JSON.stringify(passengers || []);
  await sql`
    INSERT INTO ride_plans (id, family_id, event_id, plan_type, driver_id, passengers, drive_mins, drive_km, notes)
    VALUES (
      ${id}, ${familyId}, ${event_id}, ${plan_type}, ${driver_id},
      ${passengersJson},
      ${drive_mins ?? null},
      ${drive_km ?? null},
      ${notes || ""}
    )
  `;

  const [plan] = await sql`SELECT * FROM ride_plans WHERE id = ${id}`;
  return NextResponse.json({
    ...plan,
    passengers: typeof plan.passengers === "string" ? JSON.parse(plan.passengers) : plan.passengers,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM ride_plans WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
