import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { DriverSuggestion } from "@/lib/types";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { event_location, adult_member_ids } = await req.json();
  if (!event_location || !Array.isArray(adult_member_ids) || adult_member_ids.length === 0) {
    return NextResponse.json({ error: "event_location and adult_member_ids are required" }, { status: 400 });
  }

  // Fetch adults with home addresses from DB
  const members = await sql`
    SELECT id, name, home_address FROM family_members
    WHERE family_id = ${familyId}
    AND member_type = 'adult'
    AND home_address != ''
    AND id = ANY(${adult_member_ids})
  `;

  const withAddress = members as { id: string; name: string; home_address: string }[];
  const withoutAddressIds = adult_member_ids.filter(
    (id: string) => !withAddress.find((m) => m.id === id)
  );

  // Fetch names for members without addresses
  const withoutAddressMembers: DriverSuggestion[] = [];
  if (withoutAddressIds.length > 0) {
    const rows = await sql`
      SELECT id, name FROM family_members WHERE family_id = ${familyId} AND id = ANY(${withoutAddressIds})
    `;
    for (const r of rows) {
      withoutAddressMembers.push({
        memberId: r.id as string,
        name: r.name as string,
        home_address: "",
        drive_mins: null,
        drive_km: null,
      });
    }
  }

  if (withAddress.length === 0) {
    return NextResponse.json(withoutAddressMembers);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // No API key — return all members without drive times
    const all: DriverSuggestion[] = [
      ...withAddress.map((m) => ({
        memberId: m.id,
        name: m.name,
        home_address: m.home_address,
        drive_mins: null,
        drive_km: null,
      })),
      ...withoutAddressMembers,
    ];
    return NextResponse.json(all);
  }

  // Call Google Maps Distance Matrix API
  const origins = withAddress.map((m) => encodeURIComponent(m.home_address)).join("|");
  const destination = encodeURIComponent(event_location);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destination}&units=metric&key=${apiKey}`;

  let suggestions: DriverSuggestion[] = [];
  try {
    const mapsRes = await fetch(url);
    const mapsData = await mapsRes.json();

    suggestions = withAddress.map((m, i) => {
      const element = mapsData.rows?.[i]?.elements?.[0];
      const ok = element?.status === "OK";
      return {
        memberId: m.id,
        name: m.name,
        home_address: m.home_address,
        drive_mins: ok ? Math.round(element.duration.value / 60) : null,
        drive_km: ok ? Math.round((element.distance.value / 1000) * 10) / 10 : null,
      };
    });
  } catch {
    // Maps call failed — return without times
    suggestions = withAddress.map((m) => ({
      memberId: m.id,
      name: m.name,
      home_address: m.home_address,
      drive_mins: null,
      drive_km: null,
    }));
  }

  // Sort by drive_mins ascending (nulls last), append no-address members at end
  suggestions.sort((a, b) => {
    if (a.drive_mins === null && b.drive_mins === null) return 0;
    if (a.drive_mins === null) return 1;
    if (b.drive_mins === null) return -1;
    return a.drive_mins - b.drive_mins;
  });

  return NextResponse.json([...suggestions, ...withoutAddressMembers]);
}
