import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getIcalEvents } from "@/lib/ical";
import type { DriverSuggestion } from "@/lib/types";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const {
    event_location,
    adult_member_ids,
    event_start_time,
    event_end_time,
    plan_type,
    event_id,
  } = await req.json();

  if (!event_location || !Array.isArray(adult_member_ids) || adult_member_ids.length === 0) {
    return NextResponse.json({ error: "event_location and adult_member_ids are required" }, { status: 400 });
  }

  const pt: "dropoff" | "pickup" = plan_type === "pickup" ? "pickup" : "dropoff";
  // The target arrival time: for dropoff = event start, for pickup = event end
  const arrivalTarget = pt === "dropoff"
    ? (event_start_time ? new Date(event_start_time) : null)
    : (event_end_time ? new Date(event_end_time) : null);

  // ── 1. Fetch all adult members (need ical_url for conflict check) ───────────
  const allAdults = await sql`
    SELECT id, name, home_address, ical_url
    FROM family_members
    WHERE family_id = ${familyId}
      AND member_type = 'adult'
      AND id = ANY(${adult_member_ids})
  ` as { id: string; name: string; home_address: string; ical_url: string | null }[];

  if (allAdults.length === 0) return NextResponse.json([]);

  const withAddress = allAdults.filter((m) => m.home_address?.trim());
  const withoutAddress = allAdults.filter((m) => !m.home_address?.trim());

  // ── 2. Google Maps Distance Matrix ─────────────────────────────────────────
  const driveTimeMap = new Map<string, { drive_mins: number; drive_km: number } | null>();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey && withAddress.length > 0) {
    const origins = withAddress.map((m) => encodeURIComponent(m.home_address)).join("|");
    const destination = encodeURIComponent(event_location);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destination}&units=metric&key=${apiKey}`;
    try {
      const mapsRes = await fetch(url);
      const mapsData = await mapsRes.json();
      withAddress.forEach((m, i) => {
        const element = mapsData.rows?.[i]?.elements?.[0];
        if (element?.status === "OK") {
          driveTimeMap.set(m.id, {
            drive_mins: Math.round(element.duration.value / 60),
            drive_km: Math.round((element.distance.value / 1000) * 10) / 10,
          });
        } else {
          driveTimeMap.set(m.id, null);
        }
      });
    } catch {
      withAddress.forEach((m) => driveTimeMap.set(m.id, null));
    }
  }

  // ── 3. Conflict check ──────────────────────────────────────────────────────
  const busyMemberIds = new Set<string>();

  // 3a. Local DB events overlapping the ride event
  if (event_start_time && event_end_time) {
    const overlapping = await sql`
      SELECT id, assignee_ids FROM events
      WHERE family_id = ${familyId}
        AND start_time < ${event_end_time}
        AND end_time > ${event_start_time}
        ${event_id ? sql`AND id != ${event_id}` : sql``}
    `;
    for (const ev of overlapping) {
      const ids: string[] = typeof ev.assignee_ids === "string"
        ? JSON.parse(ev.assignee_ids as string)
        : (ev.assignee_ids as string[]) || [];
      ids.forEach((id) => busyMemberIds.add(id));
    }

    // 3b. Personal iCal feeds for each adult (catches work/personal calendar conflicts)
    const rangeStart = new Date(event_start_time);
    const rangeEnd = new Date(event_end_time);
    await Promise.all(
      allAdults
        .filter((m) => m.ical_url)
        .map(async (m) => {
          try {
            const icalEvents = await getIcalEvents(m.id, m.ical_url!, rangeStart, rangeEnd);
            if (icalEvents.length > 0) busyMemberIds.add(m.id);
          } catch {
            // Ignore iCal fetch failures — don't mark as unavailable if we can't check
          }
        })
    );
  }

  // ── 4. Build suggestions ───────────────────────────────────────────────────
  function buildSuggestion(m: typeof allAdults[0]): DriverSuggestion {
    const dt = driveTimeMap.get(m.id) ?? null;
    const drive_mins = dt?.drive_mins ?? null;
    const drive_km = dt?.drive_km ?? null;
    const available = !busyMemberIds.has(m.id);

    let leave_by: string | null = null;
    if (arrivalTarget !== null && drive_mins !== null) {
      leave_by = new Date(arrivalTarget.getTime() - (drive_mins + 5) * 60 * 1000).toISOString();
    }

    return {
      memberId: m.id,
      name: m.name,
      home_address: m.home_address || "",
      drive_mins,
      drive_km,
      available,
      leave_by,
    };
  }

  const suggestions: DriverSuggestion[] = allAdults.map(buildSuggestion);

  // ── 5. Sort: available-first, then by drive_mins ascending (nulls last) ────
  suggestions.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.drive_mins === null && b.drive_mins === null) return 0;
    if (a.drive_mins === null) return 1;
    if (b.drive_mins === null) return -1;
    return a.drive_mins - b.drive_mins;
  });

  // Move no-address members within each availability tier to after those with addresses
  // (already handled by drive_mins null sort above)

  return NextResponse.json(suggestions);
}
