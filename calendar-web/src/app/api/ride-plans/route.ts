import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createGoogleEvent, deleteGoogleEvent } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────

async function deleteDriverEvent(familyId: string, driverEventId: string) {
  if (!driverEventId) return;
  const rows = await sql`
    SELECT google_event_id FROM events WHERE id = ${driverEventId} AND family_id = ${familyId}
  `;
  if (rows[0]?.google_event_id) {
    await deleteGoogleEvent(familyId, rows[0].google_event_id as string).catch(() => null);
  }
  await sql`DELETE FROM events WHERE id = ${driverEventId} AND family_id = ${familyId}`;
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  const rows = eventId
    ? await sql`SELECT * FROM ride_plans WHERE family_id = ${familyId} AND event_id = ${eventId} ORDER BY created_at`
    : await sql`SELECT * FROM ride_plans WHERE family_id = ${familyId} ORDER BY created_at`;

  const plans = rows.map((r) => ({
    ...r,
    passengers: typeof r.passengers === "string" ? JSON.parse(r.passengers) : r.passengers,
  }));

  return NextResponse.json(plans);
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const {
    event_id, plan_type, driver_id, passengers, drive_mins, drive_km, notes,
    event_title, event_start_time, event_end_time, event_location,
  } = await req.json();

  if (!event_id || !plan_type || !driver_id) {
    return NextResponse.json({ error: "event_id, plan_type, and driver_id are required" }, { status: 400 });
  }
  if (plan_type !== "dropoff" && plan_type !== "pickup") {
    return NextResponse.json({ error: "plan_type must be 'dropoff' or 'pickup'" }, { status: 400 });
  }

  // Verify event belongs to family (skip for iCal-sourced events)
  const isIcalEvent = event_id.startsWith("ical-") || event_id.startsWith("family-ical-");
  if (!isIcalEvent) {
    const [ev] = await sql`SELECT id FROM events WHERE id = ${event_id} AND family_id = ${familyId}`;
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify driver belongs to family
  const [driver] = await sql`SELECT id FROM family_members WHERE id = ${driver_id} AND family_id = ${familyId}`;
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  // Upsert: clean up old plan (and its driver event) before inserting new one
  const existingPlans = await sql`
    SELECT driver_event_id FROM ride_plans
    WHERE family_id = ${familyId} AND event_id = ${event_id} AND plan_type = ${plan_type}
  `;
  for (const old of existingPlans) {
    if (old.driver_event_id) {
      await deleteDriverEvent(familyId, old.driver_event_id as string);
    }
  }
  await sql`
    DELETE FROM ride_plans WHERE family_id = ${familyId} AND event_id = ${event_id} AND plan_type = ${plan_type}
  `;

  // ── Create driver calendar event ─────────────────────────────────────────
  let driverEventId = "";

  if (event_start_time && event_end_time) {
    const effectiveMins = typeof drive_mins === "number" && drive_mins > 0 ? drive_mins : 20;

    // Both dropoff and pickup: leave before the anchor time, return after driving back
    const anchorMs = plan_type === "pickup"
      ? new Date(event_end_time).getTime()
      : new Date(event_start_time).getTime();
    const leaveMs  = anchorMs - (effectiveMins + 5) * 60 * 1000;
    const returnMs = anchorMs + effectiveMins * 60 * 1000;

    // Look up passenger names for the event title
    let passengerDisplay = "";
    if (Array.isArray(passengers) && passengers.length > 0) {
      const nameRows = await sql`
        SELECT name FROM family_members WHERE id = ANY(${passengers}) AND family_id = ${familyId}
      `;
      passengerDisplay = nameRows.map((r) => r.name as string).join(" & ");
    }

    const driverTitle = plan_type === "pickup"
      ? `Pick up${passengerDisplay ? " " + passengerDisplay : ""} from ${event_title || "event"}`
      : `Drop off${passengerDisplay ? " " + passengerDisplay : ""} at ${event_title || "event"}`;

    driverEventId = newId();
    await sql`
      INSERT INTO events (id, family_id, title, start_time, end_time, location, notes, assignee_ids, recurrence)
      VALUES (
        ${driverEventId}, ${familyId},
        ${driverTitle},
        ${new Date(leaveMs).toISOString()},
        ${new Date(returnMs).toISOString()},
        ${event_location || ""},
        ${"__ride_driver__"},
        ${JSON.stringify([driver_id])},
        ${""}
      )
    `;

    // Sync to Google Calendar (fire-and-forget)
    const driverCalEvent: CalendarEvent = {
      id: driverEventId,
      title: driverTitle,
      start_time: new Date(leaveMs).toISOString(),
      end_time: new Date(returnMs).toISOString(),
      location: event_location || "",
      notes: "__ride_driver__",
      assignee_ids: [driver_id],
    };
    const googleId = await createGoogleEvent(familyId, driverCalEvent).catch(() => null);
    if (googleId) {
      await sql`UPDATE events SET google_event_id = ${googleId} WHERE id = ${driverEventId} AND family_id = ${familyId}`;
    }
  }

  // ── Insert ride plan ─────────────────────────────────────────────────────
  const id = newId();
  await sql`
    INSERT INTO ride_plans (id, family_id, event_id, plan_type, driver_id, passengers, drive_mins, drive_km, notes, driver_event_id)
    VALUES (
      ${id}, ${familyId}, ${event_id}, ${plan_type}, ${driver_id},
      ${JSON.stringify(passengers || [])},
      ${drive_mins ?? null},
      ${drive_km ?? null},
      ${notes || ""},
      ${driverEventId}
    )
  `;

  const [plan] = await sql`SELECT * FROM ride_plans WHERE id = ${id}`;
  return NextResponse.json({
    ...plan,
    passengers: typeof plan.passengers === "string" ? JSON.parse(plan.passengers) : plan.passengers,
  }, { status: 201 });
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();

  // Clean up the driver calendar event first
  const [plan] = await sql`SELECT driver_event_id FROM ride_plans WHERE id = ${id} AND family_id = ${familyId}`;
  if (plan?.driver_event_id) {
    await deleteDriverEvent(familyId, plan.driver_event_id as string);
  }

  await sql`DELETE FROM ride_plans WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
